import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ProofHubCredentials = { account: string; apiKey: string };
type Upload = {
  fieldName: string;
  fileName: string;
  contentType?: string;
  base64: string;
};

export class ProofHubApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ProofHubApiAdapter {
  health(credentials: ProofHubCredentials) {
    return this.request(credentials, {
      method: "GET",
      path: "/api/v3/languages",
    });
  }

  read(credentials: ProofHubCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: input.path,
      query: this.object(input.query, "query"),
    });
  }

  manage(credentials: ProofHubCredentials, input: JsonObject) {
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
    credentials: ProofHubCredentials,
    input: {
      method: "GET" | "POST" | "PUT" | "DELETE";
      path: unknown;
      query?: JsonObject;
      json?: JsonObject;
      form?: JsonObject;
      files?: Upload[];
    },
  ) {
    const origin = this.origin(credentials.account);
    if (!credentials.apiKey)
      throw new ProofHubApiError(
        "credential_missing",
        "ProofHub API key is required.",
        401,
      );
    const path = this.path(input.path, input.method);
    if (input.json && (input.form || input.files?.length))
      throw new ProofHubApiError(
        "provider_validation_error",
        "Use one ProofHub request body format at a time.",
      );
    if (input.form && !input.files?.length)
      throw new ProofHubApiError(
        "provider_validation_error",
        "ProofHub form fields are allowed only with a documented file upload.",
      );
    if (input.files?.length && path !== "/files/upload.php")
      throw new ProofHubApiError(
        "provider_validation_error",
        "ProofHub uploads are allowed only on the documented upload endpoint.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    this.rejectCredentialFields(input.form);
    const url = new URL(`${origin}${path}`);
    this.appendScalars(url.searchParams, input.query, "query");
    const { body, headers } = this.body(input);

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: input.method,
        headers: {
          Accept: "application/json",
          "X-API-KEY": credentials.apiKey,
          "User-Agent": "RelayConsole/1.0 (support@relayconsole.work)",
          ...headers,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ProofHubApiError(
        "provider_unavailable",
        "ProofHub could not be reached.",
        502,
      );
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000)
      throw new ProofHubApiError(
        "provider_validation_error",
        "ProofHub response exceeds 5 MB.",
      );
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw.slice(0, 1_000_000);
    }
    data = this.redact(data);
    if (!response.ok)
      throw new ProofHubApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `ProofHub returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private origin(value: string) {
    const account = value.trim().toLowerCase();
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(account) ||
      ["www", "api", "help", "support", "status"].includes(account)
    )
      throw new ProofHubApiError(
        "provider_validation_error",
        "ProofHub account name must be the first part of a customer proofhub.com URL.",
      );
    return `https://${account}.proofhub.com`;
  }

  private path(value: unknown, method: string) {
    if (
      typeof value !== "string" ||
      value.includes("..") ||
      value.includes("//") ||
      value.length > 2_000
    )
      throw this.invalidPath();
    if (/^\/api\/v3(?:\/[A-Za-z0-9_.:@%+\-[\]]+)*\/?$/.test(value))
      return value;
    if (method === "POST" && value === "/files/upload.php") return value;
    throw this.invalidPath();
  }

  private invalidPath() {
    return new ProofHubApiError(
      "provider_validation_error",
      "ProofHub path must be a bounded /api/v3 path or the documented upload path, without a query string or traversal.",
    );
  }

  private method(value: unknown): "POST" | "PUT" | "DELETE" {
    const method = typeof value === "string" ? value.toUpperCase() : "";
    if (!["POST", "PUT", "DELETE"].includes(method))
      throw new ProofHubApiError(
        "provider_validation_error",
        "ProofHub manage method must be POST, PUT, or DELETE.",
      );
    return method as "POST" | "PUT" | "DELETE";
  }

  private object(value: unknown, label: string) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object" || Array.isArray(value))
      throw new ProofHubApiError(
        "provider_validation_error",
        `${label} must be an object.`,
      );
    return value as JsonObject;
  }

  private uploads(value: unknown): Upload[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || value.length < 1 || value.length > 5)
      throw new ProofHubApiError(
        "provider_validation_error",
        "ProofHub files must contain one to five uploads.",
      );
    return value.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new ProofHubApiError(
          "provider_validation_error",
          "Each ProofHub upload must be an object.",
        );
      const file = item as JsonObject;
      const fieldName = this.safeName(file.fieldName, "upload field");
      const fileName = this.fileName(file.fileName);
      if (
        typeof file.base64 !== "string" ||
        file.base64.length > 5_500_000 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)
      )
        throw new ProofHubApiError(
          "provider_validation_error",
          "ProofHub upload data must be bounded base64.",
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
      throw new ProofHubApiError(
        "provider_validation_error",
        `ProofHub ${label} is invalid.`,
      );
    return value;
  }

  private fileName(value: unknown) {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 240 ||
      /[\\/\0]/.test(value)
    )
      throw new ProofHubApiError(
        "provider_validation_error",
        "ProofHub upload filename is invalid.",
      );
    return value;
  }

  private body(input: {
    json?: JsonObject;
    form?: JsonObject;
    files?: Upload[];
  }): { body?: BodyInit; headers: Record<string, string> } {
    if (input.files?.length) {
      const form = new FormData();
      const fields = new URLSearchParams();
      this.appendScalars(fields, input.form, "form");
      for (const [key, value] of fields) form.append(key, value);
      for (const file of input.files) {
        const bytes = Buffer.from(file.base64, "base64");
        if (bytes.byteLength > 4_000_000)
          throw new ProofHubApiError(
            "provider_validation_error",
            "Each ProofHub upload must be 4 MB or smaller.",
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
        throw new ProofHubApiError(
          "provider_validation_error",
          "ProofHub JSON request exceeds 1 MB.",
        );
      return { body, headers: { "Content-Type": "application/json" } };
    }
    return { headers: {} };
  }

  private appendScalars(
    params: URLSearchParams,
    value: JsonObject | undefined,
    label: string,
  ) {
    if (!value) return;
    const entries = Object.entries(value);
    if (entries.length > 50)
      throw new ProofHubApiError(
        "provider_validation_error",
        `ProofHub ${label} has too many fields.`,
      );
    for (const [key, item] of entries) {
      if (!/^[A-Za-z0-9_.\-[\]]{1,100}$/.test(key))
        throw new ProofHubApiError(
          "provider_validation_error",
          `ProofHub ${label} field is invalid.`,
        );
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new ProofHubApiError(
          "policy_blocked",
          "ProofHub credentials cannot be supplied by an agent request.",
          403,
        );
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw new ProofHubApiError(
          "provider_validation_error",
          `ProofHub ${label} array is too large.`,
        );
      for (const entry of values) {
        if (entry === undefined || entry === null || entry === "") continue;
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new ProofHubApiError(
            "provider_validation_error",
            `ProofHub ${label} values must be scalar.`,
          );
        params.append(key, String(entry).slice(0, 10_000));
      }
    }
  }

  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new ProofHubApiError(
          "policy_blocked",
          "ProofHub request is too deeply nested.",
          403,
        );
      if (Array.isArray(item)) {
        if (item.length > 500)
          throw new ProofHubApiError(
            "provider_validation_error",
            "ProofHub request array is too large.",
          );
        item.forEach((entry) => walk(entry, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 500)
        throw new ProofHubApiError(
          "provider_validation_error",
          "ProofHub request object is too large.",
        );
      for (const [key, entry] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new ProofHubApiError(
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
