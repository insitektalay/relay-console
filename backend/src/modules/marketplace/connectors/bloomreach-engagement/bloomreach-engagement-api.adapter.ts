import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  BLOOMREACH_ENGAGEMENT_OPERATION_BY_ID,
  type BloomreachEngagementOperation,
} from "./bloomreach-engagement-operation-registry";

type JsonObject = Record<string, unknown>;
export type BloomreachEngagementCredentials = {
  projectToken: string;
  apiKeyId: string;
  apiSecret: string;
};
export type BloomreachEngagementInput = {
  catalogId?: unknown;
  customerIds?: JsonObject;
  propertyNames?: unknown;
  properties?: JsonObject;
  consentAttestation?: boolean;
};

@Injectable()
export class BloomreachEngagementApiAdapter {
  private static readonly API_ORIGIN = "https://api.exponea.com";
  health(credentials: BloomreachEngagementCredentials) {
    return this.read(credentials, "list_catalogs", {});
  }
  read(
    credentials: BloomreachEngagementCredentials,
    operationId: string,
    input: BloomreachEngagementInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation(
        "Bloomreach Engagement read accepts read operations only.",
      );
    return this.request(credentials, operation, input);
  }
  manage(
    credentials: BloomreachEngagementCredentials,
    operationId: string,
    input: BloomreachEngagementInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation(
        "Bloomreach Engagement manage accepts one-customer property updates only.",
      );
    return this.request(credentials, operation, input);
  }
  private async request(
    credentials: BloomreachEngagementCredentials,
    operation: BloomreachEngagementOperation,
    input: BloomreachEngagementInput,
  ) {
    this.rejectSecrets(input);
    const projectToken = this.identifier(
      credentials.projectToken,
      "project token",
      200,
    );
    const apiKeyId = credentials.apiKeyId.trim();
    const apiSecret = credentials.apiSecret.trim();
    if (
      !apiKeyId ||
      !apiSecret ||
      apiKeyId.length > 500 ||
      apiSecret.length > 20_000
    )
      throw new BloomreachEngagementApiError(
        "credential_missing",
        "Bloomreach Engagement private API credentials are missing.",
      );
    let path = operation.path.replace(
      "{projectToken}",
      encodeURIComponent(projectToken),
    );
    if (path.includes("{catalogId}"))
      path = path.replace(
        "{catalogId}",
        encodeURIComponent(this.identifier(input.catalogId, "catalogId", 200)),
      );
    let body: string | undefined;
    if (operation.id === "get_customer_attributes") {
      const names = this.propertyNames(input.propertyNames);
      body = JSON.stringify({
        customer_ids: this.customerIds(input.customerIds),
        attributes: names.map((property) => ({ type: "property", property })),
      });
    } else if (operation.policy === "manage") {
      if (input.consentAttestation !== true)
        throw new BloomreachEngagementApiError(
          "policy_blocked",
          "Bloomreach Engagement customer updates require explicit recorded customer authorization.",
        );
      body = JSON.stringify({
        customer_ids: this.customerIds(input.customerIds),
        properties: this.properties(input.properties),
      });
    } else if (
      input.customerIds !== undefined ||
      input.propertyNames !== undefined ||
      input.properties !== undefined
    ) {
      throw this.validation(
        "Bloomreach Engagement catalog reads do not accept customer data.",
      );
    }
    if (body && Buffer.byteLength(body) > 64_000)
      throw this.validation("Bloomreach Engagement request exceeds 64 KB.");
    const url = new URL(path, BloomreachEngagementApiAdapter.API_ORIGIN);
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKeyId}:${apiSecret}`, "utf8").toString("base64")}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.policy === "manage" ? 30_000 : 20_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Bloomreach Engagement response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new BloomreachEngagementApiError(
          this.safeCode(response.status),
          `Bloomreach Engagement returned HTTP ${response.status}.`,
          response.status,
        );
      if (!Array.isArray(data) && data.success === false)
        throw this.validation("Bloomreach Engagement rejected the request.");
      return {
        data: this.redact(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof BloomreachEngagementApiError) throw error;
      throw new BloomreachEngagementApiError(
        "provider_unavailable",
        "Bloomreach Engagement could not be reached.",
      );
    }
  }
  private customerIds(value: JsonObject | undefined) {
    if (
      !value ||
      Array.isArray(value) ||
      Object.keys(value).length < 1 ||
      Object.keys(value).length > 3
    )
      throw this.validation(
        "Bloomreach Engagement customerIds must contain 1 to 3 identifiers.",
      );
    const output: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (
        !/^[A-Za-z0-9_-]{1,100}$/.test(key) ||
        typeof raw !== "string" ||
        !raw ||
        raw.length > 500 ||
        /[\u0000\r\n]/.test(raw)
      )
        throw this.validation(
          "Bloomreach Engagement customer identifier is invalid.",
        );
      output[key] = raw;
    }
    return output;
  }
  private propertyNames(value: unknown) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 20)
      throw this.validation(
        "Bloomreach Engagement propertyNames must contain 1 to 20 names.",
      );
    return value.map((entry) => this.propertyName(entry));
  }
  private properties(value: JsonObject | undefined) {
    if (
      !value ||
      Array.isArray(value) ||
      Object.keys(value).length < 1 ||
      Object.keys(value).length > 20
    )
      throw this.validation(
        "Bloomreach Engagement properties must contain 1 to 20 entries.",
      );
    const output: JsonObject = {};
    for (const [key, raw] of Object.entries(value)) {
      const name = this.propertyName(key);
      if (
        /(consent|opt.?in|opt.?out|subscription|suppression|unsubscribe)/i.test(
          name,
        )
      )
        throw new BloomreachEngagementApiError(
          "policy_blocked",
          "Bloomreach Engagement consent and subscription properties are blocked.",
        );
      if (
        !["string", "number", "boolean"].includes(typeof raw) ||
        String(raw).length > 16_000 ||
        /[\u0000]/.test(String(raw))
      )
        throw this.validation(
          `Bloomreach Engagement ${name} value is invalid.`,
        );
      output[name] = raw;
    }
    return output;
  }
  private propertyName(value: unknown) {
    return this.identifier(value, "property name", 200);
  }
  private identifier(value: unknown, label: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum || !/^[A-Za-z0-9_.:@ -]+$/.test(text))
      throw this.validation(`Bloomreach Engagement ${label} is invalid.`);
    return text;
  }
  private operation(id: string) {
    const operation = BLOOMREACH_ENGAGEMENT_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new BloomreachEngagementApiError(
        "tool_unavailable",
        "Bloomreach Engagement operation is not pinned.",
      );
    return operation;
  }
  private rejectSecrets(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value as JsonObject))
      if (
        /(api.?key|api.?secret|authorization|password|cookie|url|uri|endpoint|project.?token)/i.test(
          key,
        )
      )
        throw new BloomreachEngagementApiError(
          "policy_blocked",
          "Credential or routing Bloomreach Engagement input fields are blocked.",
        );
  }
  private parseJson(raw: Buffer): JsonObject | unknown[] {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("Bloomreach Engagement returned invalid JSON.");
  }
  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(api.?key|api.?secret|authorization|password|cookie)/i.test(key)
            ? "[REDACTED]"
            : this.redact(child),
        ]),
    );
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new BloomreachEngagementApiError(
      "provider_validation_error",
      message,
    );
  }
}
export class BloomreachEngagementApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
