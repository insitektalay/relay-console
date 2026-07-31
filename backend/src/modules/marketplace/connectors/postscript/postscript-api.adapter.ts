import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  POSTSCRIPT_OPERATION_BY_ID,
  type PostscriptOperation,
} from "./postscript-operation-registry";

type JsonObject = Record<string, unknown>;
export type PostscriptCredentials = { apiKey: string };
export type PostscriptInput = {
  pathParams?: JsonObject;
  query?: JsonObject;
  body?: JsonObject;
};

@Injectable()
export class PostscriptApiAdapter {
  private static readonly ORIGIN = "https://api.postscript.io";

  health(credentials: PostscriptCredentials) {
    return this.read(credentials, "verify_identity", {});
  }

  read(
    credentials: PostscriptCredentials,
    operationId: string,
    input: PostscriptInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.validation("Postscript read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: PostscriptCredentials,
    operationId: string,
    input: PostscriptInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.validation(
        "Postscript manage accepts mutation operations only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: PostscriptCredentials,
    operation: PostscriptOperation,
    input: PostscriptInput,
  ) {
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new PostscriptApiError(
        "credential_missing",
        "Postscript private API key is missing.",
      );
    this.rejectSecrets(input);
    const url = new URL(
      this.path(operation, input.pathParams ?? {}),
      PostscriptApiAdapter.ORIGIN,
    );
    this.query(url.searchParams, operation, input.query ?? {});
    if (
      url.origin !== PostscriptApiAdapter.ORIGIN ||
      !url.pathname.startsWith("/api/v2/")
    )
      throw new PostscriptApiError(
        "policy_blocked",
        "Postscript request escaped the fixed v2 API origin.",
      );
    let body: string | undefined;
    if (operation.body) {
      if (!input.body || typeof input.body !== "object")
        throw this.validation("Postscript operation requires a JSON body.");
      body = JSON.stringify(input.body);
      if (Buffer.byteLength(body) > 512_000)
        throw this.validation("Postscript request exceeds 512 KB.");
    } else if (input.body !== undefined)
      throw this.validation("Postscript operation does not accept a body.");
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
        throw this.validation("Postscript response exceeds 3 MB.");
      const data = this.redact(raw.length ? this.parse(raw) : {});
      if (!response.ok)
        throw new PostscriptApiError(
          this.safeCode(response.status),
          `Postscript returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof PostscriptApiError) throw error;
      throw new PostscriptApiError(
        "provider_unavailable",
        "Postscript could not be reached.",
      );
    }
  }

  private operation(id: string) {
    const operation = POSTSCRIPT_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new PostscriptApiError(
        "tool_unavailable",
        "Postscript operation is not pinned.",
      );
    return operation;
  }

  private path(operation: PostscriptOperation, params: JsonObject) {
    const allowed = new Set(operation.pathParams ?? []);
    if (Object.keys(params).some((key) => !allowed.has(key)))
      throw this.validation("Postscript path parameters are not allowlisted.");
    let path = operation.path;
    for (const name of allowed) {
      const value = typeof params[name] === "string" ? params[name].trim() : "";
      if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(value))
        throw this.validation(`Postscript ${name} is invalid.`);
      path = path.replace(`{${name}}`, encodeURIComponent(value));
    }
    return path;
  }

  private query(
    params: URLSearchParams,
    operation: PostscriptOperation,
    query: JsonObject,
  ) {
    const allowed = new Set(operation.query ?? []);
    if (Object.keys(query).some((key) => !allowed.has(key)))
      throw this.validation("Postscript query field is not allowlisted.");
    for (const [key, raw] of Object.entries(query)) {
      if (raw == null || raw === "") continue;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 25)
        throw this.validation(`Postscript ${key} has too many values.`);
      for (const value of values) {
        if (!["string", "number", "boolean"].includes(typeof value))
          throw this.validation(`Postscript ${key} must be scalar.`);
        const text = String(value);
        if (text.length > 1_000 || /[\r\n]/.test(text))
          throw this.validation(`Postscript ${key} is invalid.`);
        params.append(key, text);
      }
    }
    if (operation.id === "list_subscribers") {
      if (!params.has("page")) params.set("page", "1");
      const page = params.get("page")!;
      if (!/^\d+$/.test(page) || Number(page) !== 1)
        throw this.validation(
          "Postscript subscriber reads are fixed to page one.",
        );
    }
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (/(api.?key|token|password|secret|authorization|cookie)/i.test(key))
          throw new PostscriptApiError(
            "policy_blocked",
            "Credential-bearing Postscript input fields are blocked.",
          );
        if (/(url|uri|endpoint)$/i.test(key) && typeof child === "string") {
          let url: URL;
          try {
            url = new URL(child);
          } catch {
            throw this.validation(`Postscript ${key} must be an absolute URL.`);
          }
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            [...url.searchParams.keys()].some((name) =>
              /(key|token|secret|password|auth)/i.test(name),
            )
          )
            throw new PostscriptApiError(
              "policy_blocked",
              "Credential-bearing or non-HTTPS Postscript URLs are blocked.",
            );
        }
        walk(child);
      }
    };
    walk(value);
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((item) => this.redact(item));
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
      throw this.validation("Postscript returned invalid JSON.");
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
    return new PostscriptApiError("provider_validation_error", message);
  }
}

export class PostscriptApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
