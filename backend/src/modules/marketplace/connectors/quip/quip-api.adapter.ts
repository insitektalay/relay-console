import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export class QuipApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); } }

@Injectable()
export class QuipApiAdapter {
  getCurrentUser(token: string) { return this.request(token, { method: "GET", path: "/1/users/current" }); }
  listThreads(token: string, input: JsonObject) { return this.request(token, { method: "GET", path: "/1/users/current/threads", query: { limit: this.clamp(input.limit), cursor: this.optional(input.cursor, 2000), threads_meta: true, include_deleted: input.includeDeleted === true } }); }
  getThread(token: string, input: JsonObject) { const id = this.id(input.threadId, "threadId"); return this.request(token, { method: "GET", path: `/1/threads/${id}` }); }
  async uploadBlob(token: string, input: JsonObject) {
    this.requireToken(token); const threadId = this.id(input.threadId, "threadId"); const filename = this.required(input.filename, "filename", 240); const mimeType = this.required(input.mimeType, "mimeType", 120);
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) throw this.validation("mimeType is invalid."); const base64 = this.required(input.fileBase64, "fileBase64", 14_000_000); if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw this.validation("fileBase64 is invalid.");
    const bytes = Buffer.from(base64, "base64"); if (!bytes.length || bytes.length > 10_000_000) throw this.validation("Quip blob must be between 1 byte and 10 MB.");
    const form = new FormData(); form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
    return this.fetch(token, new URL(`https://platform.quip.com/1/blob/${threadId}`), "POST", form);
  }
  async request(token: string, input: { method: string; path: string; query?: JsonObject; form?: JsonObject; json?: JsonObject }) {
    this.requireToken(token); const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) || !/^\/[12](?:\/[A-Za-z0-9_./:@%+~-]*)?$/.test(input.path) || input.path.includes("..") || input.path.includes("//") || /^\/[12]\/oauth(?:\/|$)/.test(input.path) || /^\/[12]\/admin(?:\/|$)/.test(input.path)) throw this.validation("Quip Automation API method or path is invalid.");
    this.rejectSecrets(input.query); this.rejectSecrets(input.form); this.rejectSecrets(input.json); if (input.form && input.json) throw this.validation("Use either form or json, not both.");
    const url = new URL(`https://platform.quip.com${input.path}`); this.appendQuery(url.searchParams, input.query);
    let body: string | undefined; let contentType: string | undefined;
    if (input.form) { const params = new URLSearchParams(); this.appendQuery(params, input.form); body = params.toString(); contentType = "application/x-www-form-urlencoded"; }
    if (input.json) { body = JSON.stringify(input.json); contentType = "application/json"; }
    if (body && Buffer.byteLength(body) > 2_000_000) throw this.validation("Quip request exceeds 2 MB."); return this.fetch(token, url, method, body, contentType);
  }
  private async fetch(token: string, url: URL, method: string, body?: string | FormData, contentType?: string) {
    const response = await safeConnectorFetch(url, { method, headers: { Accept: "*/*", Authorization: `Bearer ${token}`, ...(contentType ? { "Content-Type": contentType } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
    const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.byteLength > 10_000_000) throw this.validation("Quip response exceeds 10 MB."); const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    let data: unknown; if (mimeType === "application/json" || mimeType.endsWith("+json")) { try { data = bytes.length ? JSON.parse(Buffer.from(bytes).toString("utf8")) : null; } catch { data = Buffer.from(bytes).toString("utf8").slice(0, 1_000_000); } data = this.redact(data); } else if (mimeType.startsWith("text/")) data = Buffer.from(bytes).toString("utf8").slice(0, 5_000_000); else data = { mimeType, fileBase64: Buffer.from(bytes).toString("base64"), byteLength: bytes.byteLength };
    if (!response.ok) throw new QuipApiError(this.code(response.status), this.message(data) ?? `Quip returned HTTP ${response.status}.`, response.status); return data;
  }
  private requireToken(token: string) { if (!token) throw new QuipApiError("credential_missing", "Quip access token is required.", 401); }
  private id(value: unknown, name: string) { const id = this.required(value, name, 64); if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw this.validation(`${name} is invalid.`); return id; }
  private appendQuery(params: URLSearchParams, value?: JsonObject) { if (!value) return; if (Object.keys(value).length > 60) throw this.validation("Quip parameters have too many fields."); for (const [k, v] of Object.entries(value)) { if (v == null || v === "") continue; const values = Array.isArray(v) ? v.slice(0, 100) : [v]; for (const item of values) params.append(k, typeof item === "object" ? JSON.stringify(item).slice(0, 100_000) : String(item).slice(0, 100_000)); } }
  private rejectSecrets(value?: JsonObject) { const walk = (v: unknown, d = 0) => { if (d > 12) throw new QuipApiError("policy_blocked", "Quip request is too deeply nested."); if (Array.isArray(v)) return v.forEach((x) => walk(x, d + 1)); if (!v || typeof v !== "object") return; for (const [k, x] of Object.entries(v as JsonObject)) { if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(k)) throw new QuipApiError("policy_blocked", `Credential-bearing field ${k} is not allowed.`); walk(x, d + 1); } }; if (value) walk(value); }
  private redact(value: unknown, d = 0): unknown { if (d > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 1_000_000); if (Array.isArray(value)) return value.slice(0, 1000).map((v) => this.redact(v, d + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 1000).map(([k, v]) => [k, /(token|secret|authorization|password|cookie|api.?key)/i.test(k) ? "[redacted]" : this.redact(v, d + 1)])); }
  private message(value: unknown) { const o = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const v = o?.error_description ?? o?.message ?? o?.error; return typeof v === "string" ? v.slice(0, 500) : null; }
  private code(s: number): MarketplaceConnectorSafeErrorCode { if (s === 401) return "token_expired"; if (s === 403) return "insufficient_scope"; if (s === 429) return "provider_rate_limited"; if (s >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private validation(m: string) { return new QuipApiError("provider_validation_error", m); } private required(v: unknown, n: string, max: number) { if (typeof v !== "string" || !v.trim() || v.length > max) throw this.validation(`${n} is required.`); return v.trim(); } private optional(v: unknown, max: number) { return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined; } private clamp(v: unknown) { const n = typeof v === "number" ? Math.floor(v) : 50; return Math.max(1, Math.min(100, n)); }
}
