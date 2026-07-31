import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type Document360Credentials = { apiToken: string; apiOrigin?: string };

export class Document360ApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class Document360ApiAdapter {
  listWorkspaces(credentials: Document360Credentials) {
    return this.request(credentials, { method: "GET", path: "/v2/ProjectVersions" });
  }

  listArticles(credentials: Document360Credentials, input: JsonObject) {
    const projectVersionId = this.segment(input.projectVersionId, "projectVersionId");
    return this.request(credentials, {
      method: "GET",
      path: `/v2/ProjectVersions/${projectVersionId}/articles`,
      query: {
        langCode: this.optionalString(input.languageCode, 20),
        page: this.integer(input.page, 0, 0, 10_000),
        hitsPerPage: this.integer(input.hitsPerPage, 50, 1, 100),
      },
    });
  }

  getArticle(credentials: Document360Credentials, input: JsonObject) {
    const articleId = this.segment(input.articleId, "articleId");
    const languageCode = this.segment(input.languageCode, "languageCode", 20);
    return this.request(credentials, {
      method: "GET",
      path: `/v2/Articles/${articleId}/${languageCode}`,
      query: {
        isForDisplay: false,
        appendSASToken: false,
        versionNumber: this.optionalInteger(input.versionNumber, 1, 100_000),
      },
    });
  }

  async request(credentials: Document360Credentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject; projectId?: string }) {
    this.requireCredentials(credentials);
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|DELETE)$/.test(method) || !/^\/v2(?:\/[A-Za-z0-9_./:@%+-]*)?$/.test(input.path) || input.path.includes("..") || input.path.includes("//")) {
      throw new Document360ApiError("provider_validation_error", "Document360 method or path is invalid.");
    }
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) throw new Document360ApiError("provider_validation_error", "Document360 request exceeds 1 MB.");
    const url = new URL(`${this.origin(credentials.apiOrigin)}${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    return this.fetch(credentials, url, method, body, input.projectId);
  }

  private async fetch(credentials: Document360Credentials, url: URL, method: string, body?: string, projectId?: string) {
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          api_token: credentials.apiToken,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(projectId ? { ProjectId: this.segment(projectId, "projectId") } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await response.text();
      if (Buffer.byteLength(raw) > 5_000_000) throw new Document360ApiError("provider_validation_error", "Document360 response exceeds 5 MB.");
      let data: unknown = raw;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw.slice(0, 5_000_000); }
      data = this.redact(data);
      if (!response.ok) throw new Document360ApiError(this.safeCode(response.status), this.errorMessage(data) ?? `Document360 returned HTTP ${response.status}.`, response.status);
      return data;
    } catch (error) {
      if (error instanceof Document360ApiError) throw error;
      throw new Document360ApiError("provider_unavailable", "Document360 could not be reached.", 502);
    }
  }

  private origin(value?: string) {
    const raw = (value || "https://apihub.document360.io").trim().replace(/\/+$/, "");
    let url: URL;
    try { url = new URL(raw); } catch { throw new Document360ApiError("provider_validation_error", "Document360 API origin is invalid."); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.port || url.pathname !== "/" || url.search || url.hash || !/^apihub(?:\.[a-z0-9-]{1,63})?\.document360\.io$/.test(host)) {
      throw new Document360ApiError("policy_blocked", "Document360 API origin must be an official API Hub HTTPS origin.", 403);
    }
    return `https://${host}`;
  }

  private requireCredentials(value: Document360Credentials) {
    if (!value.apiToken) throw new Document360ApiError("credential_missing", "Document360 API token is required.", 401);
    this.origin(value.apiOrigin);
  }
  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12) throw new Document360ApiError("policy_blocked", "Document360 request is too deeply nested.", 403);
      if (Array.isArray(item)) return item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (/(^|[_-])(token|secret|authorization|password|cookie|credential)($|[_-])|api.?key|(?:access|refresh|client).?(?:token|secret|key)/i.test(key)) throw new Document360ApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403);
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }
  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) throw new Document360ApiError("provider_validation_error", "Document360 query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (Array.isArray(item)) item.slice(0, 100).forEach((entry) => params.append(key, String(entry).slice(0, 10_000)));
      else params.append(key, String(item).slice(0, 10_000));
    }
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 1000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key|sas)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)]));
  }
  private errorMessage(value: unknown) {
    const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
    const errors = Array.isArray(body?.errors) ? body?.errors : [];
    const first = errors[0] && typeof errors[0] === "object" ? errors[0] as JsonObject : null;
    const candidate = body?.message ?? body?.error ?? first?.description ?? first?.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private segment(value: unknown, name: string, max = 200) {
    if (typeof value !== "string" || !value.trim() || value.length > max || !/^[A-Za-z0-9_.:@+-]+$/.test(value.trim())) throw new Document360ApiError("provider_validation_error", `${name} is invalid.`);
    return value.trim();
  }
  private optionalString(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private integer(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback; }
  private optionalInteger(value: unknown, min: number, max: number) { if (value === undefined || value === null || value === "") return undefined; const number = Number(value); if (!Number.isSafeInteger(number) || number < min || number > max) throw new Document360ApiError("provider_validation_error", "Integer value is out of range."); return number; }
}
