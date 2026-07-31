import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export class BynderApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class BynderApiAdapter {
  health(token: string, portalOrigin: string) {
    return this.request(token, portalOrigin, {
      method: "GET",
      path: "/api/v4/currentuser/",
    });
  }

  async request(
    token: string,
    portalOrigin: string,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
      form?: JsonObject;
      contentBase64?: string;
      contentType?: string;
    },
  ) {
    if (!token?.trim() || token.length > 20_000)
      throw new BynderApiError(
        "credential_missing",
        "Bynder access token is required.",
        401,
      );
    const origin = this.portalOrigin(portalOrigin);
    const method = input.method.toUpperCase();
    if (
      !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) ||
      !this.allowedPath(input.path)
    )
      throw new BynderApiError(
        "provider_validation_error",
        "Bynder method or path is outside the documented portal API boundary.",
      );
    if (method === "GET" && (input.json || input.form || input.contentBase64))
      throw new BynderApiError(
        "provider_validation_error",
        "Bynder GET requests cannot include a body.",
      );
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    this.rejectCredentials(input.form);
    const url = new URL(input.path, `${origin}/`);
    this.appendQuery(url.searchParams, input.query ?? {});
    let body: string | ArrayBuffer | undefined;
    let contentType: string | undefined;
    if (input.contentBase64 !== undefined) {
      body = Uint8Array.from(Buffer.from(input.contentBase64, "base64")).buffer;
      contentType = this.safeContentType(input.contentType);
    } else if (input.form !== undefined) {
      body = new URLSearchParams(this.scalarForm(input.form)).toString();
      contentType = "application/x-www-form-urlencoded";
    } else if (input.json !== undefined) {
      body = JSON.stringify(input.json);
      contentType = "application/json";
    }
    if (body && Buffer.byteLength(body) > 5_000_000)
      throw new BynderApiError(
        "provider_validation_error",
        "Bynder request exceeds 5 MB.",
      );
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(contentType ? { "Content-Type": contentType } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000)
        throw new BynderApiError(
          "provider_validation_error",
          "Bynder response exceeds 10 MB.",
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
        throw new BynderApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Bynder returned HTTP ${response.status}.`,
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
      if (error instanceof BynderApiError) throw error;
      throw new BynderApiError(
        "provider_unavailable",
        "Bynder could not be reached.",
        502,
      );
    }
  }

  private portalOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BynderApiError(
        "provider_validation_error",
        "Bynder portal authority is invalid.",
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
      !/^[a-z0-9.-]+$/i.test(url.hostname) ||
      !(
        url.hostname.toLowerCase() === "bynder.com" ||
        url.hostname.toLowerCase().endsWith(".bynder.com")
      )
    )
      throw new BynderApiError(
        "provider_validation_error",
        "Bynder portal must be an approved bynder.com HTTPS hostname without a path.",
      );
    return url.origin;
  }
  private allowedPath(path: string) {
    return (
      /^\/(?:api|v7)(?:\/[A-Za-z0-9_.:@%+=~,$()\[\]-]{0,300}){1,16}\/?$/.test(
        path,
      ) &&
      !path.includes("..") &&
      !path.includes("//") &&
      !/^\/v6\/authentication\//.test(path) &&
      path.length <= 3000
    );
  }
  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 100)
      throw new BynderApiError(
        "provider_validation_error",
        "Bynder request has too many query fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key))
        throw new BynderApiError(
          "provider_validation_error",
          "Bynder query key is invalid.",
        );
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new BynderApiError(
            "provider_validation_error",
            `Bynder query field ${key} must be scalar.`,
          );
        params.append(key, String(entry).slice(0, 20_000));
      }
    }
  }
  private scalarForm(value: JsonObject) {
    const pairs: Record<string, string> = {};
    for (const [key, item] of Object.entries(value)) {
      if (
        !/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof item)
      )
        throw new BynderApiError(
          "provider_validation_error",
          "Bynder form fields must be named scalar values.",
        );
      pairs[key] = String(item).slice(0, 200_000);
    }
    return pairs;
  }
  private safeContentType(value?: string) {
    const normalized =
      value?.trim().toLowerCase() ?? "application/octet-stream";
    if (
      !/^(?:application|audio|image|text|video)\/[a-z0-9.+-]{1,80}$/.test(
        normalized,
      )
    )
      throw new BynderApiError(
        "provider_validation_error",
        "Bynder content type is invalid.",
      );
    return normalized;
  }
  private rejectCredentials(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new BynderApiError(
          "policy_blocked",
          "Bynder request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return item.slice(0, 1000).forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(access.?token|refresh.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new BynderApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
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
  private message(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate =
      body?.error_description ?? body?.error ?? body?.message ?? body?.detail;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
