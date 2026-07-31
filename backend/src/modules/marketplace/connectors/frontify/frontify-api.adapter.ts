import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type OperationType = "query" | "mutation";

export class FrontifyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FrontifyApiAdapter {
  health(accessToken: string, accountOrigin: string) {
    return this.execute(accessToken, accountOrigin, "query", {
      document: "query RelayFrontifyHealth { currentUser { id } }",
      operationName: "RelayFrontifyHealth",
    });
  }

  query(accessToken: string, accountOrigin: string, input: JsonObject) {
    return this.execute(accessToken, accountOrigin, "query", input);
  }
  mutate(accessToken: string, accountOrigin: string, input: JsonObject) {
    return this.execute(accessToken, accountOrigin, "mutation", input);
  }

  private async execute(
    accessToken: string,
    accountOrigin: string,
    expected: OperationType,
    input: JsonObject,
  ) {
    if (!accessToken)
      throw new FrontifyApiError(
        "credential_missing",
        "Frontify access token is required.",
        401,
      );
    const origin = this.normalizeOrigin(accountOrigin);
    const document = this.requiredDocument(input.document);
    const operationName = this.optionalOperationName(input.operationName);
    this.assertOperation(document, expected, operationName);
    const variables = this.object(input.variables, "variables");
    this.rejectCredentialFields(variables);
    const body = JSON.stringify({
      query: document,
      ...(variables ? { variables } : {}),
      ...(operationName ? { operationName } : {}),
    });
    if (Buffer.byteLength(body) > 1_000_000)
      throw new FrontifyApiError(
        "provider_validation_error",
        "Frontify GraphQL request exceeds 1 MB.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(`${origin}/graphql`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Frontify-Beta": "enabled",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (error instanceof FrontifyApiError) throw error;
      throw new FrontifyApiError(
        "provider_unavailable",
        "Frontify GraphQL could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 10_000_000)
      throw new FrontifyApiError(
        "provider_validation_error",
        "Frontify GraphQL response exceeds 10 MB.",
      );
    let payload: unknown;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new FrontifyApiError(
        "provider_unavailable",
        "Frontify GraphQL returned an invalid response.",
        response.status,
      );
    }
    const redacted = this.redact(payload);
    const message = this.graphqlErrorMessage(redacted);
    if (!response.ok || message)
      throw new FrontifyApiError(
        response.ok
          ? this.graphqlErrorCode(redacted)
          : this.safeCode(response.status),
        message ?? `Frontify GraphQL returned HTTP ${response.status}.`,
        response.status,
      );
    return redacted;
  }

  private normalizeOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(
        /^https:\/\//i.test(value.trim())
          ? value.trim()
          : `https://${value.trim()}`,
      );
    } catch {
      throw new FrontifyApiError(
        "provider_validation_error",
        "Frontify account authority is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^[a-z0-9](?:[a-z0-9-]{0,62})\.frontify\.com$/i.test(url.hostname)
    )
      throw new FrontifyApiError(
        "provider_validation_error",
        "Frontify account must be a supported HTTPS Frontify hostname without a path.",
      );
    return url.origin;
  }

  private assertOperation(
    document: string,
    expected: OperationType,
    operationName?: string,
  ) {
    const stripped = document
      .replace(/#[^\n]*/g, " ")
      .replace(/"""[\s\S]*?"""/g, '""')
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
    if (/\b(__schema|__type)\b/.test(stripped))
      throw new FrontifyApiError(
        "policy_blocked",
        "Frontify GraphQL introspection is not available to runtime agents.",
      );
    const operations = [
      ...stripped.matchAll(
        /(?:^|[}\s])\b(query|mutation|subscription)\b\s*([A-Za-z_][A-Za-z0-9_]*)?/g,
      ),
    ].map((match) => ({ type: match[1], name: match[2] }));
    if (!operations.length && stripped.trim().startsWith("{"))
      operations.push({ type: "query", name: undefined });
    let depth = 0;
    let maxDepth = 0;
    for (const char of stripped) {
      if (char === "{") maxDepth = Math.max(maxDepth, ++depth);
      else if (char === "}" && --depth < 0) throw this.invalidDocument();
    }
    if (
      depth ||
      maxDepth > 20 ||
      operations.length !== 1 ||
      operations[0].type !== expected
    )
      throw new FrontifyApiError(
        "policy_blocked",
        `frontify.${expected === "query" ? "query" : "mutate"} accepts exactly one ${expected} operation.`,
      );
    if (operationName && operations[0].name !== operationName)
      throw new FrontifyApiError(
        "provider_validation_error",
        "operationName must match the single GraphQL operation.",
      );
  }

  private requiredDocument(value: unknown) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      Buffer.byteLength(value) > 200_000
    )
      throw new FrontifyApiError(
        "provider_validation_error",
        "document is required and must be at most 200 KB.",
      );
    return value.trim();
  }
  private optionalOperationName(value: unknown) {
    if (value == null || value === "") return undefined;
    if (
      typeof value !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]{0,199}$/.test(value)
    )
      throw new FrontifyApiError(
        "provider_validation_error",
        "operationName is invalid.",
      );
    return value;
  }
  private object(value: unknown, name: string) {
    if (value == null) return undefined;
    if (typeof value !== "object" || Array.isArray(value))
      throw new FrontifyApiError(
        "provider_validation_error",
        `${name} must be an object.`,
      );
    return value as JsonObject;
  }
  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new FrontifyApiError(
          "policy_blocked",
          "Frontify GraphQL variables are too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 500)
          throw new FrontifyApiError(
            "provider_validation_error",
            "Frontify GraphQL variable arrays may contain at most 500 items.",
          );
        return item.forEach((entry) => walk(entry, depth + 1));
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 500)
        throw new FrontifyApiError(
          "provider_validation_error",
          "Frontify GraphQL variable objects may contain at most 500 fields.",
        );
      for (const [key, entry] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new FrontifyApiError(
            "policy_blocked",
            `Credential-bearing variable ${key} is not allowed.`,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|(?:download|upload|signed).?url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }
  private graphqlErrorMessage(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const first = Array.isArray(body?.errors) ? body.errors[0] : null;
    const message =
      first && typeof first === "object" && !Array.isArray(first)
        ? (first as JsonObject).message
        : null;
    return typeof message === "string"
      ? `Frontify GraphQL: ${message.slice(0, 500)}`
      : first
        ? "Frontify GraphQL request failed."
        : null;
  }
  private graphqlErrorCode(value: unknown): MarketplaceConnectorSafeErrorCode {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const first = Array.isArray(body?.errors) ? body.errors[0] : null;
    const ext =
      first && typeof first === "object" && !Array.isArray(first)
        ? (first as JsonObject).extensions
        : null;
    const code =
      ext && typeof ext === "object" && !Array.isArray(ext)
        ? String((ext as JsonObject).code ?? "").toUpperCase()
        : "";
    if (code.includes("UNAUTH")) return "credential_missing";
    if (code.includes("FORBIDDEN") || code.includes("PERMISSION"))
      return "insufficient_scope";
    if (code.includes("RATE")) return "provider_rate_limited";
    return "provider_validation_error";
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalidDocument() {
    return new FrontifyApiError(
      "provider_validation_error",
      "Frontify GraphQL document is syntactically invalid or exceeds nesting limits.",
    );
  }
}
