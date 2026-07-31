import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GuruApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GuruApiAdapter {
  listTeams(accessToken: string) {
    return this.request(accessToken, { method: "GET", path: "/api/v1/teams" });
  }

  searchCards(accessToken: string, input: JsonObject) {
    return this.request(accessToken, {
      method: "GET",
      path: "/api/v1/search/query",
      query: {
        searchTerms: this.requiredString(input.query, "query", 1_000),
        q: this.optionalString(input.filter, 2_000),
        showArchived: input.showArchived === true ? true : undefined,
        maxResults: this.clamp(input.maxResults, 20, 1, 50),
        sortField: this.optionalEnum(input.sortField, [
          "lastModified", "lastModifiedBy", "boardCount", "verificationState",
          "copyCount", "viewCount", "favoriteCount", "dateCreated",
          "verificationInterval", "verifier", "owner", "lastVerifiedBy",
          "lastVerified", "popularity", "title",
        ]),
        sortOrder: this.optionalEnum(input.sortOrder, ["asc", "desc"]),
        token: this.optionalString(input.pageToken, 2_000),
      },
    });
  }

  async request(
    accessToken: string,
    input: { method: string; path: string; query?: JsonObject; json?: JsonObject },
  ) {
    if (!accessToken) {
      throw new GuruApiError("credential_missing", "Guru OAuth access token is required.", 401);
    }
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/v1(?:\/[A-Za-z0-9_./:@%+-]*)?$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("//")
    ) {
      throw new GuruApiError("provider_validation_error", "Guru method or path is invalid.");
    }
    this.rejectCredentialFields(
      input.query,
      0,
      input.path === "/api/v1/search/query",
    );
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) {
      throw new GuruApiError("provider_validation_error", "Guru request exceeds 1 MB.");
    }
    const url = new URL(`https://api.getguru.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const response = await safeConnectorFetch(url, {
      method,
      headers: {
        Accept: "application/json, text/plain",
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    return this.readResponse(response);
  }

  async uploadFile(accessToken: string, input: JsonObject) {
    if (!accessToken) throw new GuruApiError("credential_missing", "Guru OAuth access token is required.", 401);
    const path = this.requiredString(input.path, "path", 500);
    if (!/^\/api\/v1(?:\/[A-Za-z0-9_./:@%+-]*)+$/.test(path) || path.includes("..") || path.includes("//")) {
      throw new GuruApiError("provider_validation_error", "Guru upload path is invalid.");
    }
    const filename = this.requiredString(input.filename, "filename", 200);
    const fieldName = this.optionalEnum(input.fieldName, ["file", "logo", "image", "zip"]) ?? "file";
    const mimeType = this.optionalEnum(input.mimeType, [
      "image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf",
      "application/zip", "text/csv", "text/plain",
    ]);
    if (!mimeType) throw new GuruApiError("provider_validation_error", "mimeType must be a supported upload type.");
    const base64 = this.requiredString(input.fileBase64, "fileBase64", 14_000_000);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new GuruApiError("provider_validation_error", "fileBase64 is invalid.");
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > 10_000_000) throw new GuruApiError("provider_validation_error", "Guru uploads must be between 1 byte and 10 MB.");
    const form = new FormData();
    form.append(fieldName, new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
    const fields = this.objectOrNull(input.fields);
    this.rejectCredentialFields(fields ?? undefined);
    if (fields) {
      for (const [key, value] of Object.entries(fields).slice(0, 50)) {
        if (!/^[A-Za-z0-9_.-]{1,100}$/.test(key) || !["string", "number", "boolean"].includes(typeof value)) {
          throw new GuruApiError("provider_validation_error", "Guru upload fields must be bounded scalars.");
        }
        form.append(key, String(value).slice(0, 10_000));
      }
    }
    const response = await safeConnectorFetch(new URL(`https://api.getguru.com${path}`), {
      method: "POST",
      headers: { Accept: "application/json, text/plain", Authorization: `Bearer ${accessToken}` },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    return this.readResponse(response);
  }

  private async readResponse(response: Response) {
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000) throw new GuruApiError("provider_validation_error", "Guru response exceeds 5 MB.");
    let data: unknown = raw;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw.slice(0, 5_000_000); }
    data = this.redact(data);
    if (!response.ok) {
      throw new GuruApiError(this.safeCode(response.status), this.errorMessage(data) ?? `Guru returned HTTP ${response.status}.`, response.status);
    }
    const nextPageToken = this.nextPageToken(response.headers.get("link"));
    return nextPageToken ? { data, nextPageToken } : data;
  }

  private nextPageToken(link: string | null) {
    const match = link?.match(/<\s*([^>]+)\s*>\s*;\s*rel=["']?next-page["']?/i);
    if (!match) return undefined;
    try {
      const url = new URL(match[1]);
      if (url.protocol !== "https:" || url.hostname !== "api.getguru.com" || !url.pathname.startsWith("/api/v1/")) return undefined;
      return url.searchParams.get("token")?.slice(0, 2_000) || undefined;
    } catch { return undefined; }
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) throw new GuruApiError("provider_validation_error", "Guru query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item.slice(0, 100) : [item];
      values.forEach((entry) => params.append(key, String(entry).slice(0, 10_000)));
    }
  }

  private rejectCredentialFields(
    value: unknown,
    depth = 0,
    allowSearchPageToken = false,
  ) {
    if (depth > 12) throw new GuruApiError("policy_blocked", "Guru request is too deeply nested.");
    if (Array.isArray(value)) return value.forEach((item) => this.rejectCredentialFields(item, depth + 1, false));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (item === undefined || item === null || item === "") continue;
      if (
        allowSearchPageToken &&
        depth === 0 &&
        key === "token" &&
        typeof item === "string" &&
        item.length <= 2_000
      ) continue;
      if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new GuruApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`);
      this.rejectCredentialFields(item, depth + 1, false);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)]));
  }

  private errorMessage(value: unknown) {
    const body = this.objectOrNull(value);
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
    if (typeof value !== "string" || !value.trim() || value.length > max) throw new GuruApiError("provider_validation_error", `${name} is required and must be at most ${max} characters.`);
    return value.trim();
  }
  private optionalString(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private optionalEnum(value: unknown, values: string[]) { return typeof value === "string" && values.includes(value) ? value : undefined; }
  private clamp(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isFinite(number) ? Math.min(Math.max(Math.floor(number), min), max) : fallback; }
  private objectOrNull(value: unknown): JsonObject | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
}
