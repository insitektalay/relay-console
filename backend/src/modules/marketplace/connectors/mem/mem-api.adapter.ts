import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type MemCredentials = { apiKey: string };

export class MemApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class MemApiAdapter {
  health(credentials: MemCredentials) { return this.listNotes(credentials, { limit: 1 }); }
  listNotes(credentials: MemCredentials, input: JsonObject) {
    return this.request(credentials, { method: "GET", path: "/v2/notes", query: {
      limit: this.clamp(input.limit, 25, 1, 100),
      page: input.page,
      order_by: input.orderBy,
      collection_id: input.collectionId,
      include_note_content: input.includeNoteContent === true,
    } });
  }
  searchNotes(credentials: MemCredentials, input: JsonObject) {
    const query = this.requiredString(input.query, "query", 2_000);
    return this.request(credentials, { method: "POST", path: "/v2/notes/search", json: {
      query,
      limit: this.clamp(input.limit, 25, 1, 100),
      offset: this.clamp(input.offset, 0, 0, 100),
      ...(this.string(input.snapshotId) ? { snapshot_id: this.string(input.snapshotId) } : {}),
    } });
  }
  getNote(credentials: MemCredentials, input: JsonObject) {
    const noteId = this.uuid(input.noteId, "noteId");
    return this.request(credentials, { method: "GET", path: `/v2/notes/${noteId}` });
  }

  async request(credentials: MemCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    if (!credentials.apiKey) throw new MemApiError("credential_missing", "Mem API key is required.", 401);
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PATCH|DELETE)$/.test(method) || !/^\/v2\/[A-Za-z0-9_./-]+$/.test(input.path) || input.path.includes("..") || input.path.includes("://") || input.path.includes("//")) throw new MemApiError("provider_validation_error", "Mem method or path is invalid.");
    this.rejectSecretFields(input.query); this.rejectSecretFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) throw new MemApiError("provider_validation_error", "Mem request body exceeds the 1 MB Relay boundary.");
    const url = new URL(`https://api.mem.ai${input.path}`);
    this.append(url.searchParams, input.query);
    const response = await safeConnectorFetch(url, { method, redirect: "error", headers: { Authorization: `Bearer ${credentials.apiKey}`, Accept: "application/json", "Content-Type": "application/json" }, body });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000) throw new MemApiError("provider_validation_error", "Mem response exceeds the 2 MB Relay boundary.");
    const raw = await response.text();
    const text = raw.slice(0, 2_000_000);
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    const safe = this.redact(parsed);
    if (!response.ok) throw new MemApiError(this.code(response.status), this.message(safe) ?? `Mem returned HTTP ${response.status}.`, response.status);
    return { status: response.status, data: safe, rateLimit: { limit: response.headers.get("x-ratelimit-limit"), remaining: response.headers.get("x-ratelimit-remaining"), reset: response.headers.get("x-ratelimit-reset"), complexity: response.headers.get("x-complexity-limit") }, truncated: raw.length > text.length };
  }

  private rejectSecretFields(value?: JsonObject) { if (!value) return; const walk = (entry: unknown, depth: number) => { if (depth > 12) throw new MemApiError("policy_blocked", "Mem request is too deeply nested."); if (Array.isArray(entry)) return entry.forEach((item) => walk(item, depth + 1)); if (!entry || typeof entry !== "object") return; for (const [key, child] of Object.entries(entry as JsonObject)) { if (/(api.?key|password|secret|authorization|credential|token|cookie)/i.test(key)) throw new MemApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`); walk(child, depth + 1); } }; walk(value, 0); }
  private append(params: URLSearchParams, value?: JsonObject) { if (!value) return; if (Object.keys(value).length > 50) throw new MemApiError("provider_validation_error", "Mem query has too many fields."); for (const [key, entry] of Object.entries(value)) { if (entry === undefined || entry === null || entry === "") continue; for (const item of Array.isArray(entry) ? entry : [entry]) params.append(key, typeof item === "object" ? JSON.stringify(item) : String(item)); } }
  private redact(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 500_000); if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, entry]) => [key, /(api.?key|password|secret|authorization|credential|token|cookie)/i.test(key) ? "[redacted]" : this.redact(entry, depth + 1)])); }
  private message(value: unknown) { const object = this.object(value); return this.string(object?.message) ?? this.string(object?.error) ?? null; }
  private code(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private uuid(value: unknown, field: string) { const result = this.requiredString(value, field, 100); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new MemApiError("provider_validation_error", `${field} must be a UUID.`); return result; }
  private requiredString(value: unknown, field: string, max: number) { const result = this.string(value); if (!result || result.length > max) throw new MemApiError("provider_validation_error", `${field} is required and must be at most ${max} characters.`); return result; }
  private string(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
  private object(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
  private clamp(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isFinite(number) ? Math.min(Math.max(Math.floor(number), min), max) : fallback; }
}
