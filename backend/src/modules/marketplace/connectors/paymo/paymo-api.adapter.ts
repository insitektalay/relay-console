import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type PaymoCredentials = { apiKey: string };

type PaymoUpload = {
  fieldName: string;
  fileName: string;
  contentType?: string;
  base64: string;
};

export class PaymoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PaymoApiAdapter {
  private readonly origin = "https://app.paymoapp.com";

  health(credentials: PaymoCredentials) {
    return this.request(credentials, { method: "GET", path: "/api/me" });
  }

  read(credentials: PaymoCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: input.path,
      query: this.object(input.query, "query"),
    });
  }

  manage(credentials: PaymoCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: this.method(input.method),
      path: input.path,
      query: this.object(input.query, "query"),
      json: this.object(input.json, "json"),
      form: this.object(input.form, "form"),
      files: this.uploads(input.files),
    });
  }

  private async request(
    credentials: PaymoCredentials,
    input: {
      method: "GET" | "POST" | "PUT" | "DELETE";
      path: unknown;
      query?: JsonObject;
      json?: JsonObject;
      form?: JsonObject;
      files?: PaymoUpload[];
    },
  ) {
    if (!credentials.apiKey)
      throw new PaymoApiError(
        "credential_missing",
        "Paymo API key is required.",
        401,
      );
    const path = this.path(input.path);
    if (input.json && (input.form || input.files?.length))
      throw new PaymoApiError(
        "provider_validation_error",
        "Use one Paymo request body format at a time.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    this.rejectCredentialFields(input.form);

    const url = new URL(`${this.origin}${path}`);
    this.appendQuery(url.searchParams, input.query);
    const { body, headers } = this.body(input);

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: input.method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:relayconsole`).toString("base64")}`,
          ...headers,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new PaymoApiError(
        "provider_unavailable",
        "Paymo could not be reached.",
        502,
      );
    }

    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 7_000_000)
      throw new PaymoApiError(
        "provider_validation_error",
        "Paymo response exceeds 7 MB.",
      );
    const contentType = response.headers.get("content-type") ?? "";
    let data: unknown;
    if (/json/i.test(contentType) || this.looksLikeJson(raw)) {
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = raw.toString("utf8").slice(0, 1_000_000);
      }
      data = this.redact(data);
    } else if (/^text\//i.test(contentType) || /xml|csv/i.test(contentType)) {
      data = raw.toString("utf8").slice(0, 1_000_000);
    } else {
      data = {
        contentType: contentType || "application/octet-stream",
        byteLength: raw.byteLength,
        base64: raw.toString("base64"),
      };
    }
    if (!response.ok)
      throw new PaymoApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Paymo returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private body(input: {
    json?: JsonObject;
    form?: JsonObject;
    files?: PaymoUpload[];
  }): { body?: BodyInit; headers: Record<string, string> } {
    if (input.files?.length) {
      const form = new FormData();
      this.appendForm(form, input.form);
      for (const file of input.files) {
        const bytes = Buffer.from(file.base64, "base64");
        if (bytes.byteLength > 4_000_000)
          throw new PaymoApiError(
            "provider_validation_error",
            "Each Paymo upload must be 4 MB or smaller.",
          );
        form.append(
          file.fieldName,
          new Blob([bytes], {
            type: file.contentType || "application/octet-stream",
          }),
          file.fileName,
        );
      }
      return { body: form, headers: {} };
    }
    if (input.json) {
      const body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000)
        throw new PaymoApiError(
          "provider_validation_error",
          "Paymo JSON request exceeds 1 MB.",
        );
      return { body, headers: { "Content-Type": "application/json" } };
    }
    if (input.form) {
      const form = new URLSearchParams();
      this.appendScalarEntries(form, input.form, "Paymo form");
      return {
        body: form,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      };
    }
    return { headers: {} };
  }

  private path(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^\/api(?:\/[A-Za-z0-9_.:@%+\-[\]]+)*\/?$/.test(value) ||
      value.includes("..") ||
      value.includes("//") ||
      value.length > 2_000
    )
      throw new PaymoApiError(
        "provider_validation_error",
        "Paymo path must be a bounded /api path without a query string or traversal.",
      );
    return value;
  }

  private method(value: unknown): "POST" | "PUT" | "DELETE" {
    const method = typeof value === "string" ? value.toUpperCase() : "";
    if (!["POST", "PUT", "DELETE"].includes(method))
      throw new PaymoApiError(
        "provider_validation_error",
        "Paymo manage method must be POST, PUT, or DELETE.",
      );
    return method as "POST" | "PUT" | "DELETE";
  }

  private object(value: unknown, label: string) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object" || Array.isArray(value))
      throw new PaymoApiError(
        "provider_validation_error",
        `${label} must be an object.`,
      );
    return value as JsonObject;
  }

  private uploads(value: unknown): PaymoUpload[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || value.length > 5)
      throw new PaymoApiError(
        "provider_validation_error",
        "Paymo files must be an array of at most five uploads.",
      );
    return value.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new PaymoApiError(
          "provider_validation_error",
          "Each Paymo upload must be an object.",
        );
      const file = item as JsonObject;
      const fieldName = this.safeName(file.fieldName, "upload field");
      const fileName = this.safeFileName(file.fileName);
      if (typeof file.base64 !== "string" || file.base64.length > 5_500_000)
        throw new PaymoApiError(
          "provider_validation_error",
          "Paymo upload data must be bounded base64.",
        );
      return {
        fieldName,
        fileName,
        contentType:
          typeof file.contentType === "string"
            ? file.contentType.slice(0, 120)
            : undefined,
        base64: file.base64,
      };
    });
  }

  private safeName(value: unknown, label: string) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value))
      throw new PaymoApiError(
        "provider_validation_error",
        `Paymo ${label} is invalid.`,
      );
    return value;
  }

  private safeFileName(value: unknown) {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 240 ||
      /[\\/\0]/.test(value)
    )
      throw new PaymoApiError(
        "provider_validation_error",
        "Paymo upload filename is invalid.",
      );
    return value;
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (value) this.appendScalarEntries(params, value, "Paymo query");
  }

  private appendForm(form: FormData, value?: JsonObject) {
    if (!value) return;
    const params = new URLSearchParams();
    this.appendScalarEntries(params, value, "Paymo form");
    for (const [key, item] of params) form.append(key, item);
  }

  private appendScalarEntries(
    params: URLSearchParams,
    value: JsonObject,
    label: string,
  ) {
    const entries = Object.entries(value);
    if (entries.length > 50)
      throw new PaymoApiError(
        "provider_validation_error",
        `${label} has too many fields.`,
      );
    for (const [key, item] of entries) {
      if (!/^[A-Za-z0-9_.\-[\]]{1,100}$/.test(key))
        throw new PaymoApiError(
          "provider_validation_error",
          `${label} field is invalid.`,
        );
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new PaymoApiError(
          "policy_blocked",
          "Paymo credentials cannot be supplied by an agent request.",
          403,
        );
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw new PaymoApiError(
          "provider_validation_error",
          `${label} array is too large.`,
        );
      for (const entry of values) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new PaymoApiError(
            "provider_validation_error",
            `${label} values must be scalar.`,
          );
        params.append(key, String(entry).slice(0, 10_000));
      }
    }
  }

  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new PaymoApiError(
          "policy_blocked",
          "Paymo request is too deeply nested.",
          403,
        );
      if (Array.isArray(item)) {
        if (item.length > 500)
          throw new PaymoApiError(
            "provider_validation_error",
            "Paymo request array is too large.",
          );
        item.forEach((entry) => walk(entry, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 500)
        throw new PaymoApiError(
          "provider_validation_error",
          "Paymo request object is too large.",
        );
      for (const [key, entry] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new PaymoApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private looksLikeJson(raw: Buffer) {
    const first = raw.toString("utf8", 0, Math.min(raw.length, 20)).trim()[0];
    return first === "{" || first === "[";
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return this.sanitizeString(value);
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

  private sanitizeString(value: string) {
    const bounded = value.slice(0, 1_000_000);
    if (!/^https:\/\//i.test(bounded)) return bounded;
    try {
      const url = new URL(bounded);
      for (const key of [...url.searchParams.keys()])
        if (/(token|secret|key|signature|password)/i.test(key))
          url.searchParams.set(key, "[redacted]");
      return url.toString();
    } catch {
      return bounded;
    }
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
