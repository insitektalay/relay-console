import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class ReflectApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class ReflectApiAdapter {
  getMe(accessToken: string) { return this.request(accessToken, "GET", "/users/me"); }
  listGraphs(accessToken: string) { return this.request(accessToken, "GET", "/graphs"); }
  listBooks(accessToken: string, input: JsonObject) { return this.request(accessToken, "GET", `/graphs/${this.id(input.graphId, "graphId")}/books`); }
  listLinks(accessToken: string, input: JsonObject) { return this.request(accessToken, "GET", `/graphs/${this.id(input.graphId, "graphId")}/links`); }
  createLink(accessToken: string, input: JsonObject) {
    const rawUrl = this.required(input.url, "url", 8192);
    let url: URL; try { url = new URL(rawUrl); } catch { throw new ReflectApiError("provider_validation_error", "url must be a valid HTTP or HTTPS URL."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new ReflectApiError("policy_blocked", "Bookmark URLs must use HTTP or HTTPS and cannot contain embedded credentials.");
    return this.request(accessToken, "POST", `/graphs/${this.id(input.graphId, "graphId")}/links`, { url: url.toString(), ...(this.optional(input.title, 1000) ? { title: this.optional(input.title, 1000) } : {}), ...(this.optional(input.description, 10000) ? { description: this.optional(input.description, 10000) } : {}) });
  }
  appendDailyNote(accessToken: string, input: JsonObject) {
    const date = this.optional(input.date, 10);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ReflectApiError("provider_validation_error", "date must be YYYY-MM-DD.");
    return this.request(accessToken, "PUT", `/graphs/${this.id(input.graphId, "graphId")}/daily-notes`, { text: this.required(input.text, "text", 200000), transform_type: "list-append", ...(date ? { date } : {}), ...(this.optional(input.listName, 500) ? { list_name: this.optional(input.listName, 500) } : {}) });
  }
  createNote(accessToken: string, input: JsonObject) { return this.request(accessToken, "POST", `/graphs/${this.id(input.graphId, "graphId")}/notes`, { subject: this.required(input.subject, "subject", 1000), content_markdown: this.optional(input.contentMarkdown, 200000) ?? "", ...(typeof input.pinned === "boolean" ? { pinned: input.pinned } : {}) }); }

  private async request(accessToken: string, method: string, path: string, json?: JsonObject) {
    if (!accessToken) throw new ReflectApiError("credential_missing", "Reflect OAuth access token is required.", 401);
    const body = json ? JSON.stringify(json) : undefined;
    if (body && Buffer.byteLength(body) > 300000) throw new ReflectApiError("provider_validation_error", "Reflect request exceeds Relay's 300 KB boundary.");
    const response = await safeConnectorFetch(`https://reflect.app/api${path}`, { method, headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(20000) });
    const raw = await response.text();
    if (raw.length > 2000000) throw new ReflectApiError("provider_validation_error", "Reflect response exceeds Relay's 2 MB boundary.");
    let parsed: unknown = raw; try { parsed = raw ? JSON.parse(raw) : null; } catch {}
    const safe = this.redact(parsed);
    if (!response.ok) throw new ReflectApiError(this.code(response.status), this.message(safe) ?? `Reflect returned HTTP ${response.status}.`, response.status);
    return safe;
  }
  private id(value: unknown, field: string) { const id = this.required(value, field, 200); if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new ReflectApiError("provider_validation_error", `${field} contains unsupported characters.`); return encodeURIComponent(id); }
  private required(value: unknown, field: string, max: number) { const text = this.optional(value, max); if (!text) throw new ReflectApiError("provider_validation_error", `${field} is required and must be at most ${max} characters.`); return text; }
  private optional(value: unknown, max: number) { if (typeof value !== "string") return null; const text = value.trim(); if (text.length > max) throw new ReflectApiError("provider_validation_error", `Reflect text exceeds ${max} characters.`); return text || null; }
  private redact(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 200000); if (Array.isArray(value)) return value.slice(0, 500).map((v) => this.redact(v, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([k, v]) => [k, /(token|secret|authorization|cookie|password)/i.test(k) ? "[redacted]" : this.redact(v, depth + 1)])); }
  private message(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const object = value as JsonObject; return typeof object.message === "string" ? object.message.slice(0, 500) : typeof object.error === "string" ? object.error.slice(0, 500) : null; }
  private code(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
}
