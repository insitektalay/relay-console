import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SendGridCredentials = { apiKey: string; region: "GLOBAL" | "EU"; senderBoundary: string };

export class SendGridApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class SendGridApiAdapter {
  async health(credentials: SendGridCredentials) {
    try { return { verified: true, data: await this.getProfile(credentials) }; }
    catch (error) { if (error instanceof SendGridApiError && error.code === "insufficient_scope") return { verified: true, scopeRestricted: true }; throw error; }
  }
  getProfile(credentials: SendGridCredentials) { return this.request(credentials, { method: "GET", path: "/v3/user/profile" }); }
  listVerifiedSenders(credentials: SendGridCredentials, input: JsonObject) { return this.request(credentials, { method: "GET", path: "/v3/verified_senders", query: { limit: this.clamp(input.limit, 25, 1, 100) } }); }
  getStats(credentials: SendGridCredentials, input: JsonObject) { return this.request(credentials, { method: "GET", path: "/v3/stats", query: { start_date: this.requiredString(input.startDate, "startDate"), end_date: input.endDate, aggregated_by: input.aggregatedBy } }); }

  sendMail(credentials: SendGridCredentials, input: JsonObject) {
    const message = this.object(input.message);
    if (!message) throw new SendGridApiError("provider_validation_error", "message is required");
    this.assertSender(message, credentials.senderBoundary);
    const recipients = this.recipientCount(message);
    if (recipients < 1 || recipients > 1000) throw new SendGridApiError("provider_validation_error", "SendGrid mail must contain 1 to 1000 recipients.");
    if (Buffer.byteLength(JSON.stringify(message)) > 30 * 1024 * 1024) throw new SendGridApiError("provider_validation_error", "SendGrid mail payload exceeds 30 MB.");
    return this.request(credentials, { method: "POST", path: "/v3/mail/send", json: message });
  }

  async request(credentials: SendGridCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) || !input.path.startsWith("/v3/") || input.path.includes("..") || input.path.includes("://")) throw new SendGridApiError("provider_validation_error", "SendGrid method or path is invalid.");
    this.rejectSecretFields(input.query); this.rejectSecretFields(input.json);
    const url = new URL(`${credentials.region === "EU" ? "https://api.eu.sendgrid.com" : "https://api.sendgrid.com"}${input.path}`);
    this.append(url.searchParams, input.query);
    const headers: Record<string, string> = { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" };
    const response = await safeConnectorFetch(url, { method, headers, body: input.json ? JSON.stringify(input.json) : undefined });
    const raw = await response.text();
    const text = raw.slice(0, 512_000);
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    const safe = this.redact(parsed);
    if (!response.ok) throw new SendGridApiError(this.code(response.status), this.message(safe) ?? `SendGrid returned ${response.status}`, response.status);
    return { status: response.status, data: safe, rateLimit: { limit: response.headers.get("x-ratelimit-limit"), remaining: response.headers.get("x-ratelimit-remaining"), reset: response.headers.get("x-ratelimit-reset") }, truncated: raw.length > text.length };
  }

  private assertSender(message: JsonObject, boundary: string) { const sender = this.object(message.from); const email = this.string(sender?.email); if (!email) throw new SendGridApiError("sender_identity_not_approved", "A from.email sender is required."); const normalized = boundary.toLowerCase().replace(/^@/, ""); const allowed = normalized.includes("@") ? email.toLowerCase() === normalized : email.toLowerCase().endsWith(`@${normalized}`); if (!allowed) throw new SendGridApiError("sender_identity_not_approved", `Sender must match ${boundary}.`); }
  private recipientCount(message: JsonObject) { const personalizations = Array.isArray(message.personalizations) ? message.personalizations : []; return personalizations.reduce((total, item) => { const object = this.object(item); return total + ["to", "cc", "bcc"].reduce((sum, key) => sum + (Array.isArray(object?.[key]) ? (object![key] as unknown[]).length : 0), 0); }, 0); }
  private rejectSecretFields(value?: JsonObject) { if (!value) return; const walk = (entry: unknown, path: string) => { if (Array.isArray(entry)) return entry.forEach((item, index) => walk(item, `${path}[${index}]`)); if (!entry || typeof entry !== "object") return; for (const [key, child] of Object.entries(entry as JsonObject)) { if (/(api.?key|password|secret|authorization|credential|token)/i.test(key)) throw new SendGridApiError("policy_blocked", `Credential-bearing field ${path}${key} is not allowed.`); walk(child, `${path}${key}.`); } }; walk(value, ""); }
  private append(params: URLSearchParams, value?: JsonObject) { if (!value) return; for (const [key, entry] of Object.entries(value)) { if (entry === undefined || entry === null) continue; for (const item of Array.isArray(entry) ? entry : [entry]) params.append(key, typeof item === "object" ? JSON.stringify(item) : String(item)); } }
  private redact(value: unknown): unknown { if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redact(item)); if (!value || typeof value !== "object") return value; const result: JsonObject = {}; for (const [key, entry] of Object.entries(value as JsonObject).slice(0, 500)) result[key] = /(api.?key|password|secret|authorization|credential|token)/i.test(key) ? "[REDACTED]" : this.redact(entry); return result; }
  private message(value: unknown) { const object = this.object(value); if (!object) return null; if (Array.isArray(object.errors)) return this.string(this.object(object.errors[0])?.message); return this.string(object.message) ?? this.string(object.error); }
  private code(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private requiredString(value: unknown, field: string) { const result = this.string(value); if (!result) throw new SendGridApiError("provider_validation_error", `${field} is required`); return result; }
  private string(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
  private object(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
  private clamp(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isFinite(number) ? Math.min(Math.max(Math.floor(number), min), max) : fallback; }
}
