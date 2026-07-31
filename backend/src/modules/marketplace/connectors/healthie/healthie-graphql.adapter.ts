import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type HealthieCredentials = { apiKey: string; authorizationShard?: string };
type OperationType = "query" | "mutation";

export class HealthieGraphqlError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HealthieGraphqlAdapter {
  health(credentials: HealthieCredentials) {
    return this.execute(credentials, "query", {
      document: "query RelayHealthieHealth { currentUser { id } }",
      operationName: "RelayHealthieHealth",
    });
  }

  query(credentials: HealthieCredentials, input: JsonObject) {
    return this.execute(credentials, "query", input);
  }

  mutate(credentials: HealthieCredentials, input: JsonObject) {
    return this.execute(credentials, "mutation", input);
  }

  private async execute(
    credentials: HealthieCredentials,
    expected: OperationType,
    input: JsonObject,
  ) {
    if (!credentials.apiKey.trim()) {
      throw new HealthieGraphqlError("credential_missing", "Healthie API key is required.");
    }
    const document = typeof input.document === "string" ? input.document.trim() : "";
    if (!document || document.length > 200_000) {
      throw new HealthieGraphqlError("provider_validation_error", "A bounded Healthie GraphQL document is required.");
    }
    this.assertOperation(document, expected);
    const variables = input.variables === undefined ? undefined : this.object(input.variables);
    this.rejectCredentialFields(variables);
    const operationName = input.operationName === undefined ? undefined : String(input.operationName);
    if (operationName && !/^[A-Za-z_][A-Za-z0-9_]{0,199}$/.test(operationName)) {
      throw new HealthieGraphqlError("provider_validation_error", "operationName is invalid.");
    }
    const body = JSON.stringify({ query: document, ...(variables ? { variables } : {}), ...(operationName ? { operationName } : {}) });
    if (Buffer.byteLength(body) > 1_000_000) {
      throw new HealthieGraphqlError("provider_validation_error", "Healthie GraphQL request exceeds 1 MB.");
    }
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Basic ${credentials.apiKey}`,
      AuthorizationSource: "API",
      "Content-Type": "application/json",
      "Healthie-GraphQL-API-Version": "2026-01-01",
    };
    if (credentials.authorizationShard?.trim()) {
      headers.AuthorizationShard = credentials.authorizationShard.trim();
    }
    let response: Response;
    try {
      response = await safeConnectorFetch("https://api.gethealthie.com/graphql", {
        method: "POST",
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new HealthieGraphqlError("provider_unavailable", "Healthie GraphQL could not be reached.");
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000) {
      throw new HealthieGraphqlError("provider_validation_error", "Healthie GraphQL response exceeds 5 MB.");
    }
    let payload: unknown;
    try { payload = raw ? JSON.parse(raw) : null; }
    catch { throw new HealthieGraphqlError("provider_unavailable", "Healthie GraphQL returned an invalid response.", response.status); }
    const safe = this.redact(payload);
    const message = this.errorMessage(safe);
    if (!response.ok || message) {
      throw new HealthieGraphqlError(this.safeCode(response.status), message ?? `Healthie GraphQL returned HTTP ${response.status}.`, response.status);
    }
    return safe;
  }

  private assertOperation(document: string, expected: OperationType) {
    const scrubbed = document.replace(/#[^\n]*/g, "").replace(/"(?:\\.|[^"\\])*"/g, '""');
    if (/\b(subscription|__schema|__type)\b/.test(scrubbed)) {
      throw new HealthieGraphqlError("policy_blocked", "Healthie subscriptions and GraphQL introspection are not available to runtime agents.");
    }
    const operations = [...scrubbed.matchAll(/(?:^|[}\s])(query|mutation)\b/g)].map((match) => match[1]);
    const shorthandQuery = operations.length === 0 && scrubbed.trim().startsWith("{");
    const actual = shorthandQuery ? "query" : operations.length === 1 ? operations[0] : null;
    if (actual !== expected) {
      throw new HealthieGraphqlError("policy_blocked", `healthie.${expected === "query" ? "query" : "mutate"} accepts exactly one ${expected} operation.`);
    }
    let depth = 0;
    let maxDepth = 0;
    for (const character of scrubbed) {
      if (character === "{") maxDepth = Math.max(maxDepth, ++depth);
      if (character === "}" && --depth < 0) break;
    }
    if (depth !== 0 || maxDepth > 20) {
      throw new HealthieGraphqlError("provider_validation_error", "Healthie GraphQL document nesting is invalid or too deep.");
    }
  }

  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new HealthieGraphqlError("provider_validation_error", "variables must be an object.");
    }
    return value as JsonObject;
  }

  private rejectCredentialFields(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value as JsonObject)) {
      if (/(api.?key|authorization|password|secret|token)/i.test(key)) {
        throw new HealthieGraphqlError("policy_blocked", "Credential-shaped GraphQL variables are not accepted.");
      }
      this.rejectCredentialFields(nested);
    }
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.redact(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject).map(([key, nested]) => [key, /(api.?key|authorization|password|secret|token)/i.test(key) ? "[REDACTED]" : this.redact(nested)]));
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const errors = (value as JsonObject).errors;
    if (!Array.isArray(errors) || errors.length === 0) return null;
    const first = errors[0];
    return first && typeof first === "object" && typeof (first as JsonObject).message === "string"
      ? String((first as JsonObject).message).slice(0, 500)
      : "Healthie GraphQL rejected the operation.";
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
