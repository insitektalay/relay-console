import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
const API_ROOTS = new Set(["modern", "v1", "stats"]);
const API_VERSION = "2026-05";

export class WistiaApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class WistiaApiAdapter {
  getAccount(accessToken: string) { return this.request(accessToken, { method: "GET", path: "/modern/account" }); }
  listMedia(accessToken: string, input: JsonObject = {}) { return this.request(accessToken, { method: "GET", path: "/modern/medias", query: { page: this.integer(input.page, 1, 1, 10_000), per_page: this.integer(input.perPage, 50, 1, 100), folder_id: this.optionalId(input.folderId), name: this.optionalString(input.name, 500), type: this.optionalString(input.type, 100) } }); }
  getMedia(accessToken: string, input: JsonObject) { return this.request(accessToken, { method: "GET", path: `/modern/medias/${this.id(input.mediaId, "mediaId")}` }); }
  listFolders(accessToken: string, input: JsonObject = {}) { return this.request(accessToken, { method: "GET", path: "/modern/folders", query: { page: this.integer(input.page, 1, 1, 10_000), per_page: this.integer(input.perPage, 50, 1, 100) } }); }
  getFolder(accessToken: string, input: JsonObject) { return this.request(accessToken, { method: "GET", path: `/modern/folders/${this.id(input.folderId, "folderId")}` }); }
  search(accessToken: string, input: JsonObject) { return this.request(accessToken, { method: "GET", path: "/modern/search", query: { q: this.requiredString(input.query, "query", 500), page: this.integer(input.page, 1, 1, 10_000), per_page: this.integer(input.perPage, 50, 1, 100) } }); }

  async request(accessToken: string, input: { origin?: string; method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    if (!accessToken?.trim() || accessToken.length > 10_000) throw new WistiaApiError("credential_missing", "Wistia access token is required.", 401);
    const method = input.method.toUpperCase(); const origin = input.origin ?? "api";
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) || !["api", "upload"].includes(origin) || !this.allowedPath(origin, input.path)) throw new WistiaApiError("provider_validation_error", "Wistia method, origin, or path is outside the documented API boundary.");
    this.rejectCredentials(input.query); this.rejectCredentials(input.json);
    const url = new URL(`${origin === "upload" ? "https://upload.wistia.com" : "https://api.wistia.com"}${input.path}`); this.appendQuery(url.searchParams, input.query ?? {});
    let body: string | undefined; let contentType: string | undefined;
    if (input.json !== undefined) {
      if (origin === "upload") { const form = new URLSearchParams(); this.appendQuery(form, input.json); body = form.toString(); contentType = "application/x-www-form-urlencoded"; }
      else { body = JSON.stringify(input.json); contentType = "application/json"; }
    }
    if (body && Buffer.byteLength(body) > 2_000_000) throw new WistiaApiError("provider_validation_error", "Wistia request exceeds 2 MB.");
    try {
      const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, ...(origin === "api" ? { "X-Wistia-API-Version": API_VERSION } : {}), ...(contentType ? { "Content-Type": contentType } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
      const raw = Buffer.from(await response.arrayBuffer()); if (raw.length > 10_000_000) throw new WistiaApiError("provider_validation_error", "Wistia response exceeds 10 MB.");
      const text = raw.toString("utf8"); let data: unknown = text; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 10_000_000); } data = this.redact(data);
      if (!response.ok) throw new WistiaApiError(this.safeCode(response.status), this.message(data) ?? `Wistia returned HTTP ${response.status}.`, response.status); return data;
    } catch (error) { if (error instanceof WistiaApiError) throw error; throw new WistiaApiError("provider_unavailable", "Wistia could not be reached.", 502); }
  }

  private allowedPath(origin: string, path: string) { if (origin === "upload") return path === "/"; const match = path.match(/^\/([a-z0-9_]+)(?:\/[A-Za-z0-9_.:@%+=~-]{1,300}){0,10}$/); return !!match && API_ROOTS.has(match[1]) && !path.includes("..") && !path.includes("//") && path.length <= 2000; }
  private appendQuery(params: URLSearchParams, value: JsonObject) { if (Object.keys(value).length > 100) throw new WistiaApiError("provider_validation_error", "Wistia request has too many fields."); for (const [key, item] of Object.entries(value)) { if (item === undefined || item === null || item === "") continue; if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) throw new WistiaApiError("provider_validation_error", "Wistia request key is invalid."); const entries = Array.isArray(item) ? item.slice(0, 100) : [item]; for (const entry of entries) { if (!["string", "number", "boolean"].includes(typeof entry)) throw new WistiaApiError("provider_validation_error", `Wistia request field ${key} must be scalar.`); params.append(key, String(entry).slice(0, 20_000)); } } }
  private rejectCredentials(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new WistiaApiError("policy_blocked", "Wistia request is too deeply nested.", 403); if (Array.isArray(item)) return item.slice(0, 1000).forEach((entry) => walk(entry, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, entry] of Object.entries(item as JsonObject)) { if (/(access.?token|refresh.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new WistiaApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); walk(entry, depth + 1); } }; if (value) walk(value); }
  private redact(value: unknown, depth = 0): unknown { if (depth > 10) return "[truncated]"; if (typeof value === "string") return value.slice(0, 2_000_000); if (Array.isArray(value)) return value.slice(0, 2000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 2000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private message(value: unknown) { const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const candidate = body?.error_description ?? body?.error ?? body?.message; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private id(value: unknown, name: string) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new WistiaApiError("provider_validation_error", `${name} is invalid.`); return value; }
  private optionalId(value: unknown) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : undefined; }
  private integer(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback; }
  private optionalString(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private requiredString(value: unknown, name: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new WistiaApiError("provider_validation_error", `${name} is invalid.`); return value.trim(); }
}
