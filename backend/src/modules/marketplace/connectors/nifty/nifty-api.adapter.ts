import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type NiftyFile = {
  fieldName: string;
  name: string;
  mimeType: string;
  base64: string;
};

export class NiftyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class NiftyApiAdapter {
  health(token: string) {
    return this.request(token, { method: "GET", path: "/api/v1.0/users/me" });
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
      contentType: input.contentType === "form" ? "form" : "json",
      json: this.object(input.json),
      form: this.object(input.form),
      files: Array.isArray(input.files)
        ? (input.files as NiftyFile[])
        : undefined,
    });
  }

  async request(
    token: string,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      contentType?: "json" | "form";
      json?: JsonObject;
      form?: JsonObject;
      files?: NiftyFile[];
    },
  ) {
    if (!token)
      throw new NiftyApiError(
        "credential_missing",
        "Nifty access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/v[12]\.0(?:\/[A-Za-z0-9_./:@%+~-]*)?$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("//") ||
      input.path.includes("?") ||
      input.path.includes("#")
    ) {
      throw this.validation("Nifty method or API v1.0/v2.0 path is invalid.");
    }
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    this.rejectSecrets(input.form);
    const url = new URL(`https://openapi.niftypm.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
    let body: BodyInit | undefined;
    if (method !== "GET" && input.contentType === "form") {
      const form = new FormData();
      for (const [key, value] of Object.entries(input.form ?? {})) {
        if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key))
          throw this.validation("Nifty form field is invalid.");
        form.append(
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      }
      let total = 0;
      if ((input.files?.length ?? 0) > 10)
        throw this.validation("Nifty request has too many files.");
      for (const file of input.files ?? []) {
        if (
          !/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(file.fieldName) ||
          !/^[^/\\\u0000-\u001f]{1,255}$/.test(file.name) ||
          !/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(file.mimeType) ||
          typeof file.base64 !== "string"
        )
          throw this.validation("Nifty file metadata is invalid.");
        const buffer = Buffer.from(file.base64, "base64");
        if (
          !buffer.length ||
          buffer.toString("base64").replace(/=+$/, "") !==
            file.base64.replace(/\s+/g, "").replace(/=+$/, "")
        )
          throw this.validation("Nifty file must be valid base64.");
        total += buffer.length;
        if (total > 10_000_000)
          throw this.validation("Nifty request exceeds 10 MB.");
        form.append(
          file.fieldName,
          new Blob([buffer], { type: file.mimeType }),
          file.name,
        );
      }
      body = form;
    } else if (method !== "GET" && input.json) {
      const raw = JSON.stringify(input.json);
      if (Buffer.byteLength(raw) > 10_000_000)
        throw this.validation("Nifty request exceeds 10 MB.");
      headers["Content-Type"] = "application/json";
      body = raw;
    }
    const response = await safeConnectorFetch(url, {
      method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 10_000_000)
      throw this.validation("Nifty response exceeds 10 MB.");
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw.slice(0, 10_000_000);
    }
    data = this.redact(data);
    if (!response.ok)
      throw new NiftyApiError(
        this.code(response.status),
        this.message(data) ?? `Nifty returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw this.validation("Nifty query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key))
        throw this.validation("Nifty query field is invalid.");
      const entries = Array.isArray(item) ? item : [item];
      if (entries.length > 100)
        throw this.validation("Nifty query array is too large.");
      for (const entry of entries) {
        if (entry == null || entry === "") continue;
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw this.validation("Nifty query value is invalid.");
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
        throw new NiftyApiError(
          "policy_blocked",
          "Nifty request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 1000)
          throw new NiftyApiError(
            "policy_blocked",
            "Nifty request array is too large.",
          );
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000)
        throw new NiftyApiError(
          "policy_blocked",
          "Nifty request object is too large.",
        );
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new NiftyApiError(
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
    return new NiftyApiError("provider_validation_error", message);
  }
  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
}
