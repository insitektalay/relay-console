import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  ATTENTIVE_OPERATION_BY_ID,
  type AttentiveOperation,
} from "./attentive-operation-registry";

type JsonObject = Record<string, unknown>;
export type AttentiveCredentials = { apiKey: string };
export type AttentiveInput = {
  pathParams?: JsonObject;
  query?: JsonObject;
  body?: JsonObject;
};

@Injectable()
export class AttentiveApiAdapter {
  private static readonly ORIGIN = "https://api.attentivemobile.com";

  health(credentials: AttentiveCredentials) {
    return this.read(credentials, "get_me_v2", {});
  }

  read(
    credentials: AttentiveCredentials,
    operationId: string,
    input: AttentiveInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.validation("Attentive read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: AttentiveCredentials,
    operationId: string,
    input: AttentiveInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.validation(
        "Attentive manage accepts mutation operations only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: AttentiveCredentials,
    operation: AttentiveOperation,
    input: AttentiveInput,
  ) {
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new AttentiveApiError(
        "credential_missing",
        "Attentive API key is missing.",
      );
    this.rejectSecrets(input);
    const path = this.path(operation, input.pathParams ?? {});
    const url = new URL(path, AttentiveApiAdapter.ORIGIN);
    this.query(url.searchParams, operation, input.query ?? {});
    if (
      url.origin !== AttentiveApiAdapter.ORIGIN ||
      !/^\/v[12]\//.test(url.pathname)
    )
      throw new AttentiveApiError(
        "policy_blocked",
        "Attentive request escaped the fixed v1/v2 API origin.",
      );
    let body: string | undefined;
    if (operation.body) {
      if (!input.body || typeof input.body !== "object")
        throw this.validation("Attentive operation requires a JSON body.");
      body = JSON.stringify(input.body);
      if (Buffer.byteLength(body) > 1_000_000)
        throw this.validation(
          "Attentive request exceeds the 1 MB Relay limit.",
        );
    } else if (input.body !== undefined) {
      throw this.validation("Attentive operation does not accept a body.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
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
        throw this.validation(
          "Attentive response exceeds the 3 MB Relay limit.",
        );
      const parsed = raw.length ? this.parse(raw) : {};
      const data = this.redact(parsed, operation.id === "get_bulk_job_status");
      if (!response.ok)
        throw new AttentiveApiError(
          this.safeCode(response.status),
          `Attentive returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof AttentiveApiError) throw error;
      throw new AttentiveApiError(
        "provider_unavailable",
        "Attentive could not be reached.",
      );
    }
  }

  private operation(operationId: string) {
    const operation = ATTENTIVE_OPERATION_BY_ID.get(operationId);
    if (!operation)
      throw new AttentiveApiError(
        "tool_unavailable",
        "Attentive operation is not pinned.",
      );
    return operation;
  }

  private path(operation: AttentiveOperation, params: JsonObject) {
    const allowed = new Set(operation.pathParams ?? []);
    if (Object.keys(params).some((key) => !allowed.has(key)))
      throw this.validation("Attentive path parameters are not allowlisted.");
    let path = operation.path;
    for (const name of allowed) {
      const value = typeof params[name] === "string" ? params[name].trim() : "";
      if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(value))
        throw this.validation(`Attentive ${name} is invalid.`);
      path = path.replace(`{${name}}`, encodeURIComponent(value));
    }
    return path;
  }

  private query(
    params: URLSearchParams,
    operation: AttentiveOperation,
    query: JsonObject,
  ) {
    const allowed = new Set(operation.query ?? []);
    if (Object.keys(query).some((key) => !allowed.has(key)))
      throw this.validation("Attentive query field is not allowlisted.");
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === "") continue;
      if (!["string", "number", "boolean"].includes(typeof value))
        throw this.validation(`Attentive ${key} query value must be scalar.`);
      const text = String(value);
      if (text.length > 2_000 || /[\r\n]/.test(text))
        throw this.validation(`Attentive ${key} query value is invalid.`);
      params.set(key, text);
    }
    if (operation.id === "list_segments") {
      if (!params.has("limit")) params.set("limit", "20");
      const limit = params.get("limit")!;
      if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)
        throw this.validation("Attentive segment limit must be 1 through 100.");
    }
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (/(api.?key|token|password|secret|authorization|cookie)/i.test(key))
          throw new AttentiveApiError(
            "policy_blocked",
            "Credential-bearing Attentive input fields are blocked.",
          );
        if (/(url|uri|endpoint)$/i.test(key) && typeof child === "string") {
          let url: URL;
          try {
            url = new URL(child);
          } catch {
            throw this.validation(`Attentive ${key} must be an absolute URL.`);
          }
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            [...url.searchParams.keys()].some((name) =>
              /(key|token|secret|password|auth)/i.test(name),
            )
          )
            throw new AttentiveApiError(
              "policy_blocked",
              "Credential-bearing or non-HTTPS Attentive URLs are blocked.",
            );
        }
        walk(child);
      }
    };
    walk(value);
  }

  private redact(value: unknown, blockDownload: boolean): unknown {
    if (Array.isArray(value))
      return value
        .slice(0, 200)
        .map((item) => this.redact(item, blockDownload));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 20_000) : value;
    const out: JsonObject = {};
    for (const [key, entry] of Object.entries(value as JsonObject).slice(
      0,
      500,
    )) {
      out[key] =
        /(api.?key|token|password|secret|authorization|cookie)/i.test(key) ||
        (blockDownload && /url/i.test(key))
          ? "[REDACTED]"
          : /(url|uri|endpoint)$/i.test(key) && typeof entry === "string"
            ? this.sanitizeUrl(entry)
            : this.redact(entry, blockDownload);
    }
    return out;
  }

  private parse(raw: Buffer): unknown {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      throw this.validation("Attentive returned invalid JSON.");
    }
  }

  private sanitizeUrl(value: string) {
    try {
      const url = new URL(value);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.toString().slice(0, 2_000);
    } catch {
      return "[REDACTED_URL]";
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
    return new AttentiveApiError("provider_validation_error", message);
  }
}

export class AttentiveApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
