import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ReadMeCredentials = { apiKey: string };

export class ReadMeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ReadMeApiAdapter {
  getProject(credentials: ReadMeCredentials) {
    return this.request(credentials, { method: "GET", path: "/v2/projects/me" });
  }

  listBranches(credentials: ReadMeCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: "/v2/branches",
      query: {
        page: this.clamp(input.page, 1, 1, 1000),
        per_page: this.clamp(input.perPage, 25, 1, 100),
      },
    });
  }

  search(credentials: ReadMeCredentials, input: JsonObject) {
    const query = this.requiredString(input.query, "query", 1000);
    const perPage = this.clamp(input.perPage, 15, 1, 50);
    const section = this.optionalEnum(input.section, [
      "guides",
      "reference",
      "recipes",
      "custom_pages",
      "discuss",
      "changelog",
    ]);
    return this.request(credentials, {
      method: "GET",
      path: "/v2/search",
      query: {
        query,
        section,
        version: this.optionalString(input.version, 200),
        page: this.clamp(input.page, 1, 1, Math.floor(1000 / perPage)),
        per_page: perPage,
      },
    });
  }

  async uploadImage(credentials: ReadMeCredentials, input: JsonObject) {
    this.requireCredentials(credentials);
    const filename = this.requiredString(input.filename, "filename", 200);
    const mimeType = this.optionalEnum(input.mimeType, [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ]);
    if (!mimeType) {
      throw new ReadMeApiError(
        "provider_validation_error",
        "mimeType must be a supported image type.",
      );
    }
    const base64 = this.requiredString(input.fileBase64, "fileBase64", 7_000_000);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      throw new ReadMeApiError("provider_validation_error", "fileBase64 is invalid.");
    }
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > 5_000_000) {
      throw new ReadMeApiError(
        "provider_validation_error",
        "ReadMe image uploads must be between 1 byte and 5 MB.",
      );
    }
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(bytes)], { type: mimeType }),
      filename,
    );
    const url = new URL("https://api.readme.com/v2/images");
    const resizeHeight = this.optionalInteger(input.resizeHeight, 1, 10_000);
    if (resizeHeight) url.searchParams.set("resize_height", String(resizeHeight));
    return this.fetch(credentials, url, "POST", form);
  }

  async request(
    credentials: ReadMeCredentials,
    input: { method: string; path: string; query?: JsonObject; json?: JsonObject },
  ) {
    this.requireCredentials(credentials);
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PATCH|PUT|DELETE)$/.test(method) ||
      !/^\/v2(?:\/[A-Za-z0-9_./:@%+-]*)?$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("//")
    ) {
      throw new ReadMeApiError(
        "provider_validation_error",
        "ReadMe method or path is invalid.",
      );
    }
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) {
      throw new ReadMeApiError(
        "provider_validation_error",
        "ReadMe request exceeds 1 MB.",
      );
    }
    const url = new URL(`https://api.readme.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    return this.fetch(credentials, url, method, body);
  }

  private async fetch(
    credentials: ReadMeCredentials,
    url: URL,
    method: string,
    body?: string | FormData,
  ) {
    const response = await safeConnectorFetch(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.apiKey}`,
        ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 3_000_000) {
      throw new ReadMeApiError(
        "provider_validation_error",
        "ReadMe response exceeds 3 MB.",
      );
    }
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw.slice(0, 3_000_000);
    }
    data = this.redact(data);
    if (!response.ok) {
      throw new ReadMeApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `ReadMe returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  private requireCredentials(credentials: ReadMeCredentials) {
    if (!credentials.apiKey) {
      throw new ReadMeApiError(
        "credential_missing",
        "ReadMe API key is required.",
        401,
      );
    }
  }

  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12) {
        throw new ReadMeApiError("policy_blocked", "ReadMe request is too deeply nested.");
      }
      if (Array.isArray(item)) return item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) {
          throw new ReadMeApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        }
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) {
      throw new ReadMeApiError(
        "provider_validation_error",
        "ReadMe query has too many fields.",
      );
    }
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (Array.isArray(item)) {
        item.slice(0, 100).forEach((entry) => params.append(key, String(entry).slice(0, 10_000)));
      } else {
        params.append(key, String(item).slice(0, 10_000));
      }
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate = body?.message ?? body?.error ?? body?.detail;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new ReadMeApiError(
        "provider_validation_error",
        `${name} is required and must be at most ${max} characters.`,
      );
    }
    return value.trim();
  }

  private optionalString(value: unknown, max: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, max)
      : undefined;
  }

  private optionalEnum(value: unknown, values: string[]) {
    return typeof value === "string" && values.includes(value) ? value : undefined;
  }

  private optionalInteger(value: unknown, min: number, max: number) {
    if (value === undefined || value === null || value === "") return undefined;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw new ReadMeApiError("provider_validation_error", "Integer value is out of range.");
    }
    return number;
  }

  private clamp(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), min), max)
      : fallback;
  }
}
