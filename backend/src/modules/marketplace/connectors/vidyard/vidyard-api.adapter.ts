import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type VidyardCredentials = { apiToken: string };
const RESOURCES = new Set(["access_managers", "accounts", "allotments", "attributes", "campaigns", "captions", "categories", "chapters", "embeds", "events", "features", "gdpr_requests", "hub_categories", "hubs", "organizations", "organization", "players", "roles", "tags", "teams", "users", "videos", "webhooks"]);

export class VidyardApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class VidyardApiAdapter {
  health(credentials: VidyardCredentials) { return this.request(credentials, { method: "GET", path: "/roles/current" }); }
  listAccounts(credentials: VidyardCredentials) { return this.request(credentials, { method: "GET", path: "/accounts" }); }
  listPlayers(credentials: VidyardCredentials, input: JsonObject = {}) { return this.request(credentials, { method: "GET", path: "/players", query: { page: this.integer(input.page, 1, 1, 10_000), per_page: this.integer(input.perPage, 50, 1, 100) } }); }
  getPlayer(credentials: VidyardCredentials, input: JsonObject) { const id = this.segment(input.playerId, "playerId"); return this.request(credentials, { method: "GET", path: input.byUuid === true ? `/players/uuid=${id}` : `/players/${id}` }); }
  listVideos(credentials: VidyardCredentials, input: JsonObject = {}) { return this.request(credentials, { method: "GET", path: "/videos", query: { page: this.integer(input.page, 1, 1, 10_000), per_page: this.integer(input.perPage, 50, 1, 100) } }); }
  getVideo(credentials: VidyardCredentials, input: JsonObject) { return this.request(credentials, { method: "GET", path: `/videos/${this.segment(input.videoId, "videoId")}` }); }

  async request(credentials: VidyardCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    this.requireCredentials(credentials); const method = input.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) || !this.allowedPath(input.path)) throw new VidyardApiError("provider_validation_error", "Vidyard method or path is outside the documented Dashboard v1 resource boundary.");
    this.rejectCredentials(input.query); this.rejectCredentials(input.json);
    const url = new URL(`https://api.vidyard.com/dashboard/v1${input.path}`); url.searchParams.set("auth_token", credentials.apiToken); this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json === undefined ? undefined : JSON.stringify(input.json); if (body && Buffer.byteLength(body) > 1_000_000) throw new VidyardApiError("provider_validation_error", "Vidyard request exceeds 1 MB.");
    try {
      const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(20_000) });
      const raw = Buffer.from(await response.arrayBuffer()); if (raw.length > 5_000_000) throw new VidyardApiError("provider_validation_error", "Vidyard response exceeds 5 MB.");
      const text = raw.toString("utf8"); let data: unknown = text; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 5_000_000); } data = this.redact(data);
      if (!response.ok) throw new VidyardApiError(this.safeCode(response.status), this.message(data) ?? `Vidyard returned HTTP ${response.status}.`, response.status); return data;
    } catch (error) { if (error instanceof VidyardApiError) throw error; throw new VidyardApiError("provider_unavailable", "Vidyard could not be reached.", 502); }
  }
  private allowedPath(path: string) { const match = path.match(/^\/([a-z_]+)(?:\/[A-Za-z0-9_.:@=+-]{1,200}){0,7}$/); return !!match && RESOURCES.has(match[1]) && !path.includes("..") && path.length <= 1000; }
  private requireCredentials(c: VidyardCredentials) { if (!c.apiToken?.trim() || c.apiToken.length > 4000) throw new VidyardApiError("credential_missing", "Vidyard API token is required.", 401); }
  private rejectCredentials(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new VidyardApiError("policy_blocked", "Vidyard request is too deeply nested.", 403); if (Array.isArray(item)) return item.forEach((entry) => walk(entry, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, entry] of Object.entries(item as JsonObject)) { if (/(auth.?token|token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new VidyardApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); walk(entry, depth + 1); } }; if (value) walk(value); }
  private appendQuery(params: URLSearchParams, value: JsonObject) { if (Object.keys(value).length > 50) throw new VidyardApiError("provider_validation_error", "Vidyard query has too many fields."); for (const [key, item] of Object.entries(value)) { if (item === undefined || item === null || item === "") continue; if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) throw new VidyardApiError("provider_validation_error", "Vidyard query key is invalid."); if (Array.isArray(item)) item.slice(0, 100).forEach((entry) => params.append(key, String(entry).slice(0, 10_000))); else params.append(key, String(item).slice(0, 10_000)); } }
  private redact(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 1_000_000); if (Array.isArray(value)) return value.slice(0, 1000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 1000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private message(value: unknown) { const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const candidate = body?.message ?? body?.error ?? body?.reason; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private segment(value: unknown, name: string) { if (typeof value !== "string" || !value.trim() || value.length > 200 || !/^[A-Za-z0-9_.:@+-]+$/.test(value.trim())) throw new VidyardApiError("provider_validation_error", `${name} is invalid.`); return value.trim(); }
  private integer(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback; }
}
