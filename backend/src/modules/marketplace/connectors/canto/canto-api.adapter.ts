import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export class CantoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CantoApiAdapter {
  health(token: string, accountOrigin: string) {
    return this.request(token, accountOrigin, {
      method: "GET",
      path: "/api/v1/user",
    });
  }

  async request(
    token: string,
    accountOrigin: string,
    input: { method: string; path: string; query?: JsonObject; json?: unknown },
  ) {
    if (!token?.trim() || token.length > 20_000)
      throw new CantoApiError(
        "credential_missing",
        "Canto access token is required.",
        401,
      );
    const origin = this.accountOrigin(accountOrigin);
    const method = input.method.toUpperCase();
    if (
      !["GET", "POST", "PUT", "DELETE"].includes(method) ||
      !this.allowedPath(input.path)
    )
      throw new CantoApiError(
        "provider_validation_error",
        "Canto method or path is outside the documented V1 API boundary.",
      );
    if (method === "GET" && input.json !== undefined)
      throw new CantoApiError(
        "provider_validation_error",
        "Canto GET requests cannot include a body.",
      );
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    const url = new URL(input.path, `${origin}/`);
    this.appendQuery(url.searchParams, input.query ?? {});
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body) > 5_000_000)
      throw new CantoApiError(
        "provider_validation_error",
        "Canto request exceeds 5 MB.",
      );
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000)
        throw new CantoApiError(
          "provider_validation_error",
          "Canto response exceeds 10 MB.",
        );
      const text = raw.toString("utf8");
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      data = this.redact(data);
      if (!response.ok)
        throw new CantoApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Canto returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        status: response.status,
        data,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          reset: response.headers.get("x-ratelimit-reset"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof CantoApiError) throw error;
      throw new CantoApiError(
        "provider_unavailable",
        "Canto could not be reached.",
        502,
      );
    }
  }

  private accountOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new CantoApiError(
        "provider_validation_error",
        "Canto account authority is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !this.isCantoHost(url.hostname)
    )
      throw new CantoApiError(
        "provider_validation_error",
        "Canto account must be a supported HTTPS Canto hostname without a path.",
      );
    return url.origin;
  }
  private isCantoHost(host: string) {
    return (
      /^[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63})*\.(?:canto\.com|canto\.global|canto\.de)$/i.test(
        host,
      ) ||
      /^[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63})*\.ca\.canto\.com$/i.test(
        host,
      )
    );
  }
  private allowedPath(path: string) {
    return (
      /^\/api\/v1(?:\/[A-Za-z0-9_.:@%+=~,$()\[\]-]{0,300}){1,16}\/?$/.test(
        path,
      ) &&
      !path.includes("..") &&
      !path.includes("//") &&
      path.length <= 3000
    );
  }
  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 100)
      throw new CantoApiError(
        "provider_validation_error",
        "Canto request has too many query fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.$\[\]-]{1,100}$/.test(key))
        throw new CantoApiError(
          "provider_validation_error",
          "Canto query key is invalid.",
        );
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new CantoApiError(
            "provider_validation_error",
            `Canto query field ${key} must be scalar.`,
          );
        params.append(key, String(entry).slice(0, 20_000));
      }
    }
  }
  private rejectCredentials(value: unknown, depth = 0) {
    if (depth > 12)
      throw new CantoApiError(
        "policy_blocked",
        "Canto request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value
        .slice(0, 1000)
        .forEach((entry) => this.rejectCredentials(entry, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value as JsonObject)) {
      if (
        /(access.?token|refresh.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new CantoApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentials(entry, depth + 1);
    }
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 2_000_000);
    if (Array.isArray(value))
      return value.slice(0, 2000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key|download.?url|signed.?url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private message(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const object = value as JsonObject;
    for (const key of ["message", "error_description", "error"])
      if (typeof object[key] === "string")
        return String(object[key]).slice(0, 500);
    return null;
  }
}
