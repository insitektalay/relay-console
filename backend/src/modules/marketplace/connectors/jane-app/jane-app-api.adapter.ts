import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PATCH";
export type JaneAppCredentials = { accessToken: string; clinicOrigin: string };
const ID = "[0-9a-fA-F-]{1,100}";
const READ_GET_ROUTES = [
  /^\/api\/2026-01-01\/medical-record\/observations$/,
  new RegExp(`^/api/2026-01-01/medical-record/observations/${ID}$`),
  /^\/api\/2026-01-01\/medical-record\/care-plans$/,
  new RegExp(`^/api/2026-01-01/medical-record/care-plans/${ID}$`),
  new RegExp(
    `^/api/2026-01-01/medical-record/care-plans/${ID}/activities/${ID}$`,
  ),
  /^\/api\/2026-01-01\/medical-record\/medications$/,
  new RegExp(`^/api/2026-01-01/medical-record/medications/${ID}$`),
  new RegExp(`^/api/2026-01-01/medical-record/medications/${ID}/history$`),
  /^\/api\/2026-01-01\/patients$/,
  new RegExp(`^/api/2026-01-01/patients/${ID}$`),
  /^\/api\/2026-01-01\/locations$/,
  new RegExp(`^/api/2026-01-01/locations/${ID}$`),
  /^\/api\/2026-01-01\/staff_members$/,
  new RegExp(`^/api/2026-01-01/staff_members/${ID}$`),
  /^\/api\/2026-01-01\/appointments$/,
  new RegExp(`^/api/2026-01-01/appointments/${ID}$`),
  /^\/api\/2026-01-01\/company$/,
  new RegExp(`^/api/2026-01-01/document-uploads/${ID}$`),
  /^\/api\/2026-01-01\/disciplines$/,
  new RegExp(`^/api/2026-01-01/disciplines/${ID}$`),
  /^\/api\/2026-01-01\/treatments$/,
  new RegExp(`^/api/2026-01-01/treatments/${ID}$`),
];
const READ_POST_ROUTES = [/^\/api\/2026-01-01\/patients\/search$/];
const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/api\/2026-01-01\/medical-record\/observations$/],
  ["PATCH", new RegExp(`^/api/2026-01-01/medical-record/observations/${ID}$`)],
  ["POST", /^\/api\/2026-01-01\/medical-record\/care-plans$/],
  ["PATCH", new RegExp(`^/api/2026-01-01/medical-record/care-plans/${ID}$`)],
  [
    "POST",
    new RegExp(`^/api/2026-01-01/medical-record/care-plans/${ID}/activities$`),
  ],
  [
    "PATCH",
    new RegExp(
      `^/api/2026-01-01/medical-record/care-plans/${ID}/activities/${ID}$`,
    ),
  ],
  ["POST", /^\/api\/2026-01-01\/medical-record\/medications$/],
  ["PATCH", new RegExp(`^/api/2026-01-01/medical-record/medications/${ID}$`)],
  ["POST", /^\/api\/2026-01-01\/document-uploads$/],
];

export class JaneAppApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class JaneAppApiAdapter {
  health(credentials: JaneAppCredentials) {
    return this.request(credentials, {
      method: "GET",
      path: "/api/2026-01-01/company",
    });
  }

  read(credentials: JaneAppCredentials, input: JsonObject) {
    const method = (
      this.optional(input.method, "method", 10) ?? "GET"
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (
      !(
        (method === "GET" && this.matches(READ_GET_ROUTES, path)) ||
        (method === "POST" && this.matches(READ_POST_ROUTES, path))
      )
    ) {
      throw this.validation("Jane App read endpoint is not supported.");
    }
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  manage(credentials: JaneAppCredentials, input: JsonObject) {
    const method = this.required(
      input.method,
      "method",
      10,
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (
      !MANAGE_ROUTES.some(
        ([allowed, pattern]) => allowed === method && pattern.test(path),
      )
    ) {
      throw this.validation("Jane App mutation endpoint is not supported.");
    }
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
      fileBase64:
        this.optional(input.fileBase64, "fileBase64", 70_000_000) ?? undefined,
      fileName: this.optional(input.fileName, "fileName", 200) ?? undefined,
      contentType:
        this.optional(input.contentType, "contentType", 100) ?? undefined,
    });
  }

  private async request(
    credentials: JaneAppCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
      fileBase64?: string;
      fileName?: string;
      contentType?: string;
    },
  ) {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken || accessToken.length > 20_000)
      throw new JaneAppApiError(
        "credential_missing",
        "Jane App OAuth access token is required.",
        401,
      );
    const origin = this.clinicOrigin(credentials.clinicOrigin);
    const permitted =
      (input.method === "GET" && this.matches(READ_GET_ROUTES, input.path)) ||
      (input.method === "POST" && this.matches(READ_POST_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted) throw this.validation("Jane App endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`${origin}${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    let body: BodyInit | undefined;
    if (input.path === "/api/2026-01-01/document-uploads") {
      if (!input.fileBase64 || !input.fileName || !input.contentType)
        throw this.validation(
          "Jane App document upload requires fileBase64, fileName, and contentType.",
        );
      if (
        !new Set(["application/pdf", "image/jpeg", "image/png"]).has(
          input.contentType,
        )
      )
        throw this.validation(
          "Jane App accepts PDF, JPEG, or PNG documents only.",
        );
      if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/.test(input.fileName))
        throw this.validation("Jane App document file name is invalid.");
      const bytes = Buffer.from(input.fileBase64, "base64");
      if (!bytes.length || bytes.byteLength > 50_000_000)
        throw this.validation(
          "Jane App document must be between 1 byte and 50 MB.",
        );
      const form = new FormData();
      form.set(
        "file",
        new Blob([bytes], { type: input.contentType }),
        input.fileName,
      );
      body = form;
    } else if (input.json && input.method !== "GET") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Jane App request exceeds 2 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 10_000_000)
        throw this.validation("Jane App response exceeds 10 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new JaneAppApiError(
          this.code(response.status),
          this.message(data) ?? `Jane returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof JaneAppApiError) throw error;
      throw new JaneAppApiError(
        "provider_unavailable",
        "Jane App could not be reached.",
        502,
      );
    }
  }

  private clinicOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.validation("Jane App clinic URL is invalid.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^[a-z0-9][a-z0-9-]{0,62}\.janeapp\.com$/i.test(url.hostname)
    )
      throw this.validation(
        "Jane App clinic URL must be an exact HTTPS clinic.janeapp.com origin.",
      );
    return url.origin;
  }
  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }
  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 30)
      throw this.validation("Jane App query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].-]{1,100}$/.test(key))
        throw this.validation("Jane App query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Jane App query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Jane App query value is invalid.");
        params.append(key, String(child).slice(0, 10_000));
      }
    }
  }
  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }
  private optional(value: unknown, label: string, max: number) {
    if (value == null || value === "") return null;
    return this.required(value, label, max);
  }
  private required(value: unknown, label: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`Jane App ${label} is invalid.`);
    return value.trim();
  }
  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new JaneAppApiError(
          "policy_blocked",
          "Jane App request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 1000)
          throw new JaneAppApiError(
            "policy_blocked",
            "Jane App request array is too large.",
          );
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000)
        throw new JaneAppApiError(
          "policy_blocked",
          "Jane App request object is too large.",
        );
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new JaneAppApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key|signing.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const errors = Array.isArray(object?.errors) ? object.errors : [];
    const first =
      errors[0] && typeof errors[0] === "object"
        ? (errors[0] as JsonObject)
        : null;
    const candidate =
      first?.message ?? first?.detail ?? object?.message ?? object?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 400 && status < 500) return "provider_validation_error";
    return "provider_unavailable";
  }
  private validation(message: string) {
    return new JaneAppApiError("provider_validation_error", message, 400);
  }
}
