import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ShortcutCredentials = { apiToken: string };

export class ShortcutApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ShortcutApiAdapter {
  private readonly origin = "https://api.app.shortcut.com";

  health(credentials: ShortcutCredentials) {
    return this.request(credentials, { method: "GET", path: "/api/v3/member" });
  }

  read(credentials: ShortcutCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: input.path,
      query: this.object(input.query, "query"),
    });
  }

  write(credentials: ShortcutCredentials, input: JsonObject) {
    const method = this.method(input.method);
    return this.request(credentials, {
      method,
      path: input.path,
      query: this.object(input.query, "query"),
      json: this.object(input.json, "json"),
    });
  }

  private async request(
    credentials: ShortcutCredentials,
    input: {
      method: "GET" | "POST" | "PUT" | "DELETE";
      path: unknown;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.apiToken)
      throw new ShortcutApiError(
        "credential_missing",
        "Shortcut API token is required.",
        401,
      );
    const path = this.path(input.path);
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body) > 1_000_000)
      throw new ShortcutApiError(
        "provider_validation_error",
        "Shortcut request exceeds 1 MB.",
      );
    const url = new URL(`${this.origin}${path}`);
    this.appendQuery(url.searchParams, input.query);

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: input.method,
        headers: {
          Accept: "application/json",
          "Shortcut-Token": credentials.apiToken,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ShortcutApiError(
        "provider_unavailable",
        "Shortcut could not be reached.",
        502,
      );
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000)
      throw new ShortcutApiError(
        "provider_validation_error",
        "Shortcut response exceeds 5 MB.",
      );
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw.slice(0, 5_000_000);
    }
    data = this.redact(data);
    if (!response.ok)
      throw new ShortcutApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Shortcut returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private path(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^\/api\/v3(?:\/[A-Za-z0-9_.:@%+-]+)*\/?$/.test(value) ||
      value.includes("..") ||
      value.includes("//") ||
      value.length > 2_000
    )
      throw new ShortcutApiError(
        "provider_validation_error",
        "Shortcut path must be a bounded /api/v3 path without a query string or traversal.",
      );
    return value;
  }

  private method(value: unknown): "POST" | "PUT" | "DELETE" {
    const method = typeof value === "string" ? value.toUpperCase() : "";
    if (method !== "POST" && method !== "PUT" && method !== "DELETE")
      throw new ShortcutApiError(
        "provider_validation_error",
        "Shortcut write method must be POST, PUT, or DELETE.",
      );
    return method;
  }

  private object(value: unknown, label: string) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object" || Array.isArray(value))
      throw new ShortcutApiError(
        "provider_validation_error",
        `${label} must be an object.`,
      );
    return value as JsonObject;
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    const entries = Object.entries(value);
    if (entries.length > 50)
      throw new ShortcutApiError(
        "provider_validation_error",
        "Shortcut query has too many fields.",
      );
    for (const [key, item] of entries) {
      if (!/^[A-Za-z0-9_.-]{1,100}$/.test(key))
        throw new ShortcutApiError(
          "provider_validation_error",
          "Shortcut query field is invalid.",
        );
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw new ShortcutApiError(
          "provider_validation_error",
          "Shortcut query array is too large.",
        );
      for (const entry of values) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new ShortcutApiError(
            "provider_validation_error",
            "Shortcut query values must be scalar.",
          );
        params.append(key, String(entry).slice(0, 10_000));
      }
    }
  }

  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new ShortcutApiError(
          "policy_blocked",
          "Shortcut request is too deeply nested.",
          403,
        );
      if (Array.isArray(item)) {
        if (item.length > 500)
          throw new ShortcutApiError(
            "provider_validation_error",
            "Shortcut request array is too large.",
          );
        item.forEach((entry) => walk(entry, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 500)
        throw new ShortcutApiError(
          "provider_validation_error",
          "Shortcut request object is too large.",
        );
      for (const [key, entry] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new ShortcutApiError(
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
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate = object?.message ?? object?.error ?? object?.detail;
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
