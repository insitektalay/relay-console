import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
const ROOTS = new Set([
  "me", "users", "videos", "folders", "categories", "channels", "groups",
  "albums", "ondemand", "live_events", "webinars", "portfolios", "tags",
  "languages", "contentratings", "creativecommons", "oauth",
]);

export class VimeoApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class VimeoApiAdapter {
  getMe(accessToken: string) { return this.request(accessToken, { method: "GET", path: "/me" }); }
  listVideos(accessToken: string, input: JsonObject = {}) { return this.request(accessToken, { method: "GET", path: "/me/videos", query: this.pageQuery(input, true) }); }
  getVideo(accessToken: string, input: JsonObject) { return this.request(accessToken, { method: "GET", path: `/videos/${this.numericId(input.videoId, "videoId")}` }); }
  listFolders(accessToken: string, input: JsonObject = {}) { return this.request(accessToken, { method: "GET", path: "/me/projects", query: this.pageQuery(input, false) }); }
  getFolder(accessToken: string, input: JsonObject) { return this.request(accessToken, { method: "GET", path: `/me/projects/${this.numericId(input.folderId, "folderId")}` }); }

  async request(accessToken: string, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    if (!accessToken?.trim() || accessToken.length > 10_000) throw new VimeoApiError("credential_missing", "Vimeo access token is required.", 401);
    const method = input.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) || !this.allowedPath(input.path)) throw new VimeoApiError("provider_validation_error", "Vimeo method or path is outside the documented API resource boundary.");
    this.rejectCredentials(input.query); this.rejectCredentials(input.json);
    const url = new URL(`https://api.vimeo.com${input.path}`); this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body) > 2_000_000) throw new VimeoApiError("provider_validation_error", "Vimeo request exceeds 2 MB.");
    try {
      const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/vnd.vimeo.*+json;version=3.4", Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000) throw new VimeoApiError("provider_validation_error", "Vimeo response exceeds 10 MB.");
      const text = raw.toString("utf8"); let data: unknown = text;
      try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 10_000_000); }
      data = this.redact(data);
      if (!response.ok) throw new VimeoApiError(this.safeCode(response.status), this.message(data) ?? `Vimeo returned HTTP ${response.status}.`, response.status);
      return data;
    } catch (error) {
      if (error instanceof VimeoApiError) throw error;
      throw new VimeoApiError("provider_unavailable", "Vimeo could not be reached.", 502);
    }
  }

  private allowedPath(path: string) { const match = path.match(/^\/([a-z_]+)(?:\/[A-Za-z0-9_.:@%+=~-]{1,300}){0,10}$/); return !!match && ROOTS.has(match[1]) && !path.includes("..") && !path.includes("//") && path.length <= 2000; }
  private pageQuery(input: JsonObject, includeSort: boolean) { return { page: this.integer(input.page, 1, 1, 10_000), per_page: this.integer(input.perPage, 50, 1, 100), query: this.optionalString(input.query, 500), ...(includeSort ? { sort: this.enumValue(input.sort, ["date", "alphabetical", "plays", "likes", "comments", "duration", "modified_time"]), direction: this.enumValue(input.direction, ["asc", "desc"]) } : {}) }; }
  private appendQuery(params: URLSearchParams, value: JsonObject) { if (Object.keys(value).length > 100) throw new VimeoApiError("provider_validation_error", "Vimeo query has too many fields."); for (const [key, item] of Object.entries(value)) { if (item === undefined || item === null || item === "") continue; if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) throw new VimeoApiError("provider_validation_error", "Vimeo query key is invalid."); const entries = Array.isArray(item) ? item.slice(0, 100) : [item]; for (const entry of entries) { if (!["string", "number", "boolean"].includes(typeof entry)) throw new VimeoApiError("provider_validation_error", `Vimeo query field ${key} must be scalar.`); params.append(key, String(entry).slice(0, 20_000)); } } }
  private rejectCredentials(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new VimeoApiError("policy_blocked", "Vimeo request is too deeply nested.", 403); if (Array.isArray(item)) return item.slice(0, 1000).forEach((entry) => walk(entry, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, entry] of Object.entries(item as JsonObject)) { if (/(access.?token|refresh.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new VimeoApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); walk(entry, depth + 1); } }; if (value) walk(value); }
  private redact(value: unknown, depth = 0): unknown { if (depth > 10) return "[truncated]"; if (typeof value === "string") return value.slice(0, 2_000_000); if (Array.isArray(value)) return value.slice(0, 2000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 2000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private message(value: unknown) { const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const candidate = body?.developer_message ?? body?.error_description ?? body?.error ?? body?.message; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private numericId(value: unknown, name: string) { if (typeof value !== "string" || !/^[0-9]{1,30}$/.test(value)) throw new VimeoApiError("provider_validation_error", `${name} is invalid.`); return value; }
  private integer(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback; }
  private optionalString(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private enumValue(value: unknown, allowed: string[]) { return typeof value === "string" && allowed.includes(value) ? value : undefined; }
}
