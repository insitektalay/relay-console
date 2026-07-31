import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

export type ContentfulCmaOrigin = "https://api.contentful.com" | "https://api.eu.contentful.com";

export class ContentfulApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class ContentfulApiAdapter {
  async getCurrentUser(token: string, origin: string) { return this.request(token, origin, "GET", "/users/me"); }
  async listSpaces(token: string, origin: string, input: Record<string, unknown>) { return this.request(token, origin, "GET", "/spaces", this.page(input)); }
  async getSpace(token: string, origin: string, input: Record<string, unknown>) { return this.request(token, origin, "GET", `/spaces/${this.id(input.spaceId, "spaceId")}`); }
  async listEnvironments(token: string, origin: string, input: Record<string, unknown>) { return this.request(token, origin, "GET", `/spaces/${this.id(input.spaceId, "spaceId")}/environments`, this.page(input)); }
  async listContentTypes(token: string, origin: string, input: Record<string, unknown>) { return this.request(token, origin, "GET", `${this.env(input)}/content_types`, this.page(input)); }
  async getContentType(token: string, origin: string, input: Record<string, unknown>) { return this.request(token, origin, "GET", `${this.env(input)}/content_types/${this.id(input.contentTypeId, "contentTypeId")}`); }
  async listEntries(token: string, origin: string, input: Record<string, unknown>) {
    const query = this.page(input); if (input.contentTypeId) query.set("content_type", this.id(input.contentTypeId, "contentTypeId"));
    return this.request(token, origin, "GET", `${this.env(input)}/entries`, query);
  }
  async getEntry(token: string, origin: string, input: Record<string, unknown>) { return this.request(token, origin, "GET", `${this.env(input)}/entries/${this.id(input.entryId, "entryId")}`); }
  prepareEntryChange(input: Record<string, unknown>) { const normalized = this.normalize(input); return { normalized, payloadHash: this.hash(normalized), providerMutation: false }; }
  async createDraft(token: string, origin: string, input: Record<string, unknown>) {
    return this.request(token, origin, "POST", `${this.env(input)}/entries`, undefined, { fields: this.fields(input.fields) }, { "X-Contentful-Content-Type": this.id(input.contentTypeId, "contentTypeId") });
  }
  async updateDraft(token: string, origin: string, input: Record<string, unknown>) {
    return this.request(token, origin, "PUT", `${this.env(input)}/entries/${this.id(input.entryId, "entryId")}`, undefined, { fields: this.fields(input.fields) }, { "X-Contentful-Version": String(this.version(input.expectedVersion)) });
  }
  async publishEntry(token: string, origin: string, input: Record<string, unknown>) {
    return this.request(token, origin, "PUT", `${this.env(input)}/entries/${this.id(input.entryId, "entryId")}/published`, undefined, {}, { "X-Contentful-Version": String(this.version(input.expectedVersion)) });
  }
  private env(input: Record<string, unknown>) { return `/spaces/${this.id(input.spaceId, "spaceId")}/environments/${this.id(input.environmentId, "environmentId")}`; }
  private page(input: Record<string, unknown>) { const q = new URLSearchParams(); q.set("limit", String(this.int(input.limit, 10, 1, 25))); q.set("skip", String(this.int(input.skip, 0, 0, 100000))); return q; }
  private id(value: unknown, field: string) { const s = String(value ?? ""); if (!/^[A-Za-z0-9_-]{1,128}$/.test(s)) throw new ContentfulApiError("provider_validation_error", `${field} is invalid`, 400); return encodeURIComponent(s); }
  private version(value: unknown) { const n = Number(value); if (!Number.isInteger(n) || n < 1) throw new ContentfulApiError("provider_validation_error", "expectedVersion must be a positive integer", 400); return n; }
  private int(value: unknown, fallback: number, min: number, max: number) { const n = value === undefined ? fallback : Number(value); if (!Number.isInteger(n) || n < min || n > max) throw new ContentfulApiError("provider_validation_error", "Pagination is outside the allowed range", 400); return n; }
  private fields(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContentfulApiError("provider_validation_error", "fields must be an object", 400); const entries = Object.entries(value); if (entries.length < 1 || entries.length > 40) throw new ContentfulApiError("provider_validation_error", "fields must contain 1 to 40 fields", 400); const safe = this.bound(value, 0); if (Buffer.byteLength(JSON.stringify(safe)) > 250_000) throw new ContentfulApiError("provider_validation_error", "fields are too large", 400); return safe; }
  private normalize(input: Record<string, unknown>) { const copy = { ...input }; delete copy.approvalId; delete copy.idempotencyKey; if (copy.fields) copy.fields = this.fields(copy.fields); return copy; }
  private hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
  private origin(value: string): ContentfulCmaOrigin { if (value === "https://api.contentful.com" || value === "https://api.eu.contentful.com") return value; throw new ContentfulApiError("connection_not_ready", "Contentful CMA origin is invalid", 400); }
  private bound(value: unknown, depth: number): any { if (depth > 6) return null; if (typeof value === "string") return value.slice(0, 10_000); if (Array.isArray(value)) return value.slice(0, 50).map((v) => this.bound(v, depth + 1)); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 80).map(([k, v]) => [k, /token|secret|password|api[_-]?key/i.test(k) ? "[redacted]" : this.bound(v, depth + 1)])); return value; }
  private async request(token: string, origin: string, method: string, path: string, query?: URLSearchParams, body?: unknown, extra: Record<string, string> = {}) {
    if (!token) throw new ContentfulApiError("connection_not_ready", "Contentful access token is unavailable", 401);
    const url = new URL(path, this.origin(origin)); if (query) url.search = query.toString();
    const response = await safeConnectorFetch(url, { method, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.contentful.management.v1+json", "Content-Type": "application/vnd.contentful.management.v1+json", ...extra }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" });
    const text = await response.text(); let parsed: unknown = {}; if (text) { try { parsed = JSON.parse(text); } catch { parsed = {}; } }
    if (!response.ok) { const code: MarketplaceConnectorSafeErrorCode = response.status === 401 ? "token_expired" : response.status === 403 ? "insufficient_scope" : response.status === 404 || response.status === 409 ? "provider_validation_error" : response.status === 429 ? "provider_rate_limited" : "provider_unavailable"; throw new ContentfulApiError(code, `Contentful request failed (${response.status})`, response.status); }
    return this.bound(parsed, 0);
  }
}
