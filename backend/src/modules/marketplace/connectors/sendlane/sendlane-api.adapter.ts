import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  SENDLANE_OPERATION_BY_ID,
  type SendlaneOperation,
} from "./sendlane-operation-registry";

type JsonObject = Record<string, unknown>;
export type SendlaneCredentials = {
  apiToken: string;
  integrationToken: string;
};
export type SendlaneInput = { body?: JsonObject };

@Injectable()
export class SendlaneApiAdapter {
  private static readonly ORIGIN = "https://api.sendlane.com";

  health(credentials: SendlaneCredentials) {
    return this.read(credentials, "list_senders", {});
  }

  read(
    credentials: SendlaneCredentials,
    operationId: string,
    input: SendlaneInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.validation("Sendlane read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  track(
    credentials: SendlaneCredentials,
    operationId: string,
    input: SendlaneInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "POST")
      throw this.validation("Sendlane track accepts POST operations only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: SendlaneCredentials,
    operation: SendlaneOperation,
    input: SendlaneInput,
  ) {
    const apiToken = credentials.apiToken.trim();
    const integrationToken = credentials.integrationToken.trim();
    if (!apiToken || apiToken.length > 20_000)
      throw new SendlaneApiError(
        "credential_missing",
        "Sendlane API v2 token is missing.",
      );
    if (!integrationToken || integrationToken.length > 20_000)
      throw new SendlaneApiError(
        "credential_missing",
        "Sendlane custom integration token is missing.",
      );
    this.rejectSecrets(input);
    const url = new URL(operation.path, SendlaneApiAdapter.ORIGIN);
    if (
      url.origin !== SendlaneApiAdapter.ORIGIN ||
      !url.pathname.startsWith("/v2/") ||
      url.search
    )
      throw new SendlaneApiError(
        "policy_blocked",
        "Sendlane request escaped the fixed v2 API boundary.",
      );
    let body: string | undefined;
    if (operation.body) {
      if (!input.body || typeof input.body !== "object")
        throw this.validation(
          "Sendlane tracking operation requires a JSON body.",
        );
      body = JSON.stringify({ ...input.body, token: integrationToken });
      if (Buffer.byteLength(body) > 512_000)
        throw this.validation("Sendlane request exceeds 512 KB.");
    } else if (input.body !== undefined) {
      throw this.validation("Sendlane read does not accept a body.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.method === "GET" ? 20_000 : 30_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 3_000_000)
        throw this.validation("Sendlane response exceeds 3 MB.");
      const data = this.redact(raw.length ? this.parse(raw) : {});
      if (!response.ok)
        throw new SendlaneApiError(
          this.safeCode(response.status),
          `Sendlane returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof SendlaneApiError) throw error;
      throw new SendlaneApiError(
        "provider_unavailable",
        "Sendlane could not be reached.",
      );
    }
  }

  private operation(id: string) {
    const operation = SENDLANE_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new SendlaneApiError(
        "tool_unavailable",
        "Sendlane operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (/(api.?key|token|password|secret|authorization|cookie)/i.test(key))
          throw new SendlaneApiError(
            "policy_blocked",
            "Credential-bearing Sendlane input fields are blocked.",
          );
        if (/(url|uri|endpoint)$/i.test(key) && typeof child === "string") {
          let url: URL;
          try {
            url = new URL(child);
          } catch {
            throw this.validation(`Sendlane ${key} must be an absolute URL.`);
          }
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            [...url.searchParams.keys()].some((name) =>
              /(key|token|secret|password|auth)/i.test(name),
            )
          )
            throw new SendlaneApiError(
              "policy_blocked",
              "Credential-bearing or non-HTTPS Sendlane URLs are blocked.",
            );
        }
        walk(child);
      }
    };
    walk(value);
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 20_000) : value;
    const out: JsonObject = {};
    for (const [key, entry] of Object.entries(value as JsonObject).slice(
      0,
      500,
    ))
      out[key] = /(api.?key|token|password|secret|authorization|cookie)/i.test(
        key,
      )
        ? "[REDACTED]"
        : this.redact(entry);
    return out;
  }

  private parse(raw: Buffer): unknown {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      throw this.validation("Sendlane returned invalid JSON.");
    }
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new SendlaneApiError("provider_validation_error", message);
  }
}

export class SendlaneApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
