import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class ProductboardApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ProductboardApiAdapter {
  health(token: string) {
    return this.request(token, {
      method: "GET",
      path: "/v2/entities",
      query: { "type[]": "product", limit: 1 },
    });
  }

  read(token: string, input: JsonObject) {
    return this.request(token, {
      method: "GET",
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
    });
  }

  manage(token: string, input: JsonObject) {
    return this.request(token, {
      method: this.required(input.method, "method", 10),
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  async request(
    token: string,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!token)
      throw new ProductboardApiError(
        "credential_missing",
        "Productboard access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/v2(?:\/[A-Za-z0-9_./:@%+~-]*)?$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("//") ||
      input.path.includes("?") ||
      input.path.includes("#")
    ) {
      throw this.validation("Productboard method or REST v2 path is invalid.");
    }
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.validation("Productboard request exceeds 2 MB.");

    const url = new URL(`https://api.productboard.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
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
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 10_000_000)
      throw this.validation("Productboard response exceeds 10 MB.");
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw.slice(0, 10_000_000);
    }
    data = this.redact(data);
    if (!response.ok)
      throw new ProductboardApiError(
        this.code(response.status),
        this.message(data) ?? `Productboard returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw this.validation("Productboard query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key))
        throw this.validation("Productboard query field is invalid.");
      if (item == null || item === "") continue;
      const entries = Array.isArray(item) ? item : [item];
      if (entries.length > 100)
        throw this.validation("Productboard query array is too large.");
      for (const entry of entries) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw this.validation("Productboard query value is invalid.");
        params.append(key, String(entry).slice(0, 10_000));
      }
    }
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new ProductboardApiError(
          "policy_blocked",
          "Productboard request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      for (const [key, child] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new ProductboardApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate = object?.message ?? object?.error ?? object?.detail;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new ProductboardApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
}
