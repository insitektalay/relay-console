import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export class ConfluenceApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); } }

@Injectable()
export class ConfluenceApiAdapter {
  listSpaces(token: string, cloudId: string, input: JsonObject) { return this.request(token, cloudId, { method: "GET", path: "/wiki/api/v2/spaces", query: { limit: this.clamp(input.limit), cursor: this.optional(input.cursor, 2000) } }); }
  listPages(token: string, cloudId: string, input: JsonObject) { return this.request(token, cloudId, { method: "GET", path: "/wiki/api/v2/pages", query: { limit: this.clamp(input.limit), cursor: this.optional(input.cursor, 2000), "space-id": this.optional(input.spaceId, 100) } }); }
  getPage(token: string, cloudId: string, input: JsonObject) { const id = this.required(input.pageId, "pageId", 100); if (!/^[A-Za-z0-9_-]+$/.test(id)) throw this.validation("pageId is invalid."); return this.request(token, cloudId, { method: "GET", path: `/wiki/api/v2/pages/${id}`, query: { "body-format": this.optional(input.bodyFormat, 40) } }); }
  async uploadAttachment(token: string, cloudId: string, input: JsonObject) {
    if (!token) throw new ConfluenceApiError("credential_missing", "Confluence access token is required.", 401);
    if (!/^[A-Za-z0-9-]{1,100}$/.test(cloudId)) throw this.validation("Confluence cloud ID is invalid.");
    const pageId = this.required(input.pageId, "pageId", 100); if (!/^[A-Za-z0-9_-]+$/.test(pageId)) throw this.validation("pageId is invalid.");
    const filename = this.required(input.filename, "filename", 240); const mimeType = this.required(input.mimeType, "mimeType", 120);
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) throw this.validation("mimeType is invalid.");
    const base64 = this.required(input.fileBase64, "fileBase64", 14_000_000); if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw this.validation("fileBase64 is invalid.");
    const bytes = Buffer.from(base64, "base64"); if (!bytes.length || bytes.length > 10_000_000) throw this.validation("Confluence attachment must be between 1 byte and 10 MB.");
    const form = new FormData(); form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
    const comment = this.optional(input.comment, 1000); if (comment) form.append("comment", comment); if (input.minorEdit === true) form.append("minorEdit", "true");
    const response = await safeConnectorFetch(`https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/content/${pageId}/child/attachment`, { method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "X-Atlassian-Token": "no-check" }, body: form, redirect: "error", signal: AbortSignal.timeout(30_000) });
    const raw = await response.text(); if (Buffer.byteLength(raw) > 5_000_000) throw this.validation("Confluence response exceeds 5 MB.");
    let data: unknown = raw; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw.slice(0, 5_000_000); } data = this.redact(data);
    if (!response.ok) throw new ConfluenceApiError(this.code(response.status), this.message(data) ?? `Confluence returned HTTP ${response.status}.`, response.status); return data;
  }
  async request(token: string, cloudId: string, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    if (!token) throw new ConfluenceApiError("credential_missing", "Confluence access token is required.", 401);
    if (!/^[A-Za-z0-9-]{1,100}$/.test(cloudId)) throw this.validation("Confluence cloud ID is invalid.");
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) || !/^\/wiki\/(?:api\/v2|rest\/api)(?:\/[A-Za-z0-9_./:@%+~-]*)?$/.test(input.path) || input.path.includes("..") || input.path.includes("//")) throw this.validation("Confluence method or path is invalid.");
    this.rejectSecrets(input.query); this.rejectSecrets(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 2_000_000) throw this.validation("Confluence request exceeds 2 MB.");
    const url = new URL(`https://api.atlassian.com/ex/confluence/${cloudId}${input.path}`); this.appendQuery(url.searchParams, input.query);
    const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(20_000) });
    const raw = await response.text(); if (Buffer.byteLength(raw) > 5_000_000) throw this.validation("Confluence response exceeds 5 MB.");
    let data: unknown = raw; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw.slice(0, 5_000_000); } data = this.redact(data);
    if (!response.ok) throw new ConfluenceApiError(this.code(response.status), this.message(data) ?? `Confluence returned HTTP ${response.status}.`, response.status);
    return data;
  }
  private appendQuery(params: URLSearchParams, value?: JsonObject) { if (!value) return; if (Object.keys(value).length > 50) throw this.validation("Confluence query has too many fields."); for (const [key, item] of Object.entries(value)) { if (item == null || item === "") continue; (Array.isArray(item) ? item.slice(0, 100) : [item]).forEach((entry) => params.append(key, String(entry).slice(0, 10000))); } }
  private rejectSecrets(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new ConfluenceApiError("policy_blocked", "Confluence request is too deeply nested."); if (Array.isArray(item)) return item.forEach((v) => walk(v, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, child] of Object.entries(item as JsonObject)) { if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new ConfluenceApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`); walk(child, depth + 1); } }; if (value) walk(value); }
  private redact(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 1_000_000); if (Array.isArray(value)) return value.slice(0, 500).map((v) => this.redact(v, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([k, v]) => [k, /(token|secret|authorization|password|cookie|api.?key)/i.test(k) ? "[redacted]" : this.redact(v, depth + 1)])); }
  private message(value: unknown) { const o = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const v = o?.message ?? o?.error ?? o?.detail; return typeof v === "string" ? v.slice(0, 500) : null; }
  private code(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "token_expired"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private validation(message: string) { return new ConfluenceApiError("provider_validation_error", message); }
  private required(value: unknown, name: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw this.validation(`${name} is required.`); return value.trim(); }
  private optional(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private clamp(value: unknown) { const n = typeof value === "number" ? Math.floor(value) : 25; return Math.max(1, Math.min(100, n)); }
}
