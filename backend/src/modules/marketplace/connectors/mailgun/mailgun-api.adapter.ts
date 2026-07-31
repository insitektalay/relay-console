import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type MailgunCredentials = { apiKey: string; domain: string; region: "US" | "EU"; keyType: "account" | "domain_sending" };

export class MailgunApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class MailgunApiAdapter {
  async health(credentials: MailgunCredentials) {
    if (credentials.keyType === "domain_sending") return { verified: false, sendOnly: true };
    return { verified: true, data: await this.request(credentials, { method: "GET", path: `/v4/domains/${encodeURIComponent(credentials.domain)}` }) };
  }

  getDomain(credentials: MailgunCredentials) {
    this.requireAccountKey(credentials);
    return this.request(credentials, { method: "GET", path: `/v4/domains/${encodeURIComponent(credentials.domain)}` });
  }

  listEvents(credentials: MailgunCredentials, input: JsonObject) {
    this.requireAccountKey(credentials);
    return this.request(credentials, { method: "GET", path: `/v3/${encodeURIComponent(credentials.domain)}/events`, query: { event: input.event, limit: this.clamp(input.limit, 25, 1, 100), begin: input.begin, end: input.end, ascending: input.ascending === true ? "yes" : "no" } });
  }

  queryMetrics(credentials: MailgunCredentials, input: JsonObject) {
    this.requireAccountKey(credentials);
    return this.request(credentials, { method: "POST", path: "/v1/analytics/metrics", json: { ...input, filter: { AND: [{ attribute: "domain", comparator: "=", values: [{ label: credentials.domain, value: credentials.domain }] }] } } });
  }

  sendMessage(credentials: MailgunCredentials, input: JsonObject) {
    const from = this.requiredString(input.from, "from");
    if (!this.senderUsesDomain(from, credentials.domain)) throw new MailgunApiError("sender_identity_not_approved", `Sender must use ${credentials.domain}.`);
    const to = this.stringArray(input.to, 100);
    if (!to.length) throw new MailgunApiError("provider_validation_error", "to is required");
    const fields: JsonObject = { from, to, subject: this.requiredString(input.subject, "subject") };
    for (const key of ["cc", "bcc", "tags"] as const) { const values = this.stringArray(input[key], 100); if (values.length) fields[key === "tags" ? "o:tag" : key] = values; }
    for (const key of ["text", "html"] as const) { const value = this.string(input[key]); if (value) fields[key] = value; }
    const replyTo = this.string(input.replyTo); if (replyTo) fields["h:Reply-To"] = replyTo;
    return this.request(credentials, { method: "POST", path: `/v3/${encodeURIComponent(credentials.domain)}/messages`, fields });
  }

  async request(credentials: MailgunCredentials, input: { method: string; path: string; query?: JsonObject; fields?: JsonObject; json?: JsonObject }) {
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) || !/^\/v[1-5]\//.test(input.path) || input.path.includes("..") || input.path.includes("://")) throw new MailgunApiError("provider_validation_error", "Mailgun method or path is invalid.");
    this.assertBoundDomain(input.path, credentials.domain);
    this.rejectSecretFields(input.query); this.rejectSecretFields(input.fields); this.rejectSecretFields(input.json);
    if (credentials.keyType === "domain_sending" && input.path !== `/v3/${encodeURIComponent(credentials.domain)}/messages` && input.path !== `/v3/${encodeURIComponent(credentials.domain)}/messages.mime`) throw new MailgunApiError("insufficient_scope", "A Domain Sending Key can only send for its bound domain.");
    const url = new URL(`${credentials.region === "EU" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net"}${input.path}`);
    this.append(url.searchParams, input.query);
    const headers: Record<string, string> = { Authorization: `Basic ${Buffer.from(`api:${credentials.apiKey}`).toString("base64")}` };
    let body: BodyInit | undefined;
    if (input.fields) { const form = new FormData(); this.appendForm(form, input.fields); body = form; }
    else if (input.json) { headers["Content-Type"] = "application/json"; body = JSON.stringify(input.json); }
    const response = await safeConnectorFetch(url, { method, headers, body });
    const text = (await response.text()).slice(0, 512_000);
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    const safe = this.redact(parsed);
    if (!response.ok) throw new MailgunApiError(this.code(response.status), this.message(safe) ?? `Mailgun returned ${response.status}`, response.status);
    return { status: response.status, data: safe, rateLimit: { limit: response.headers.get("ratelimit-limit"), remaining: response.headers.get("ratelimit-remaining"), reset: response.headers.get("ratelimit-reset") }, truncated: text.length >= 512_000 };
  }

  private requireAccountKey(credentials: MailgunCredentials) { if (credentials.keyType !== "account") throw new MailgunApiError("insufficient_scope", "This operation requires a Mailgun account or RBAC key."); }
  private assertBoundDomain(path: string, domain: string) { for (const segment of path.split("/").filter(Boolean).slice(1)) { const decoded = decodeURIComponent(segment).toLowerCase(); if (decoded.includes(".") && /^[a-z0-9.-]+$/.test(decoded) && decoded !== domain.toLowerCase()) throw new MailgunApiError("policy_blocked", "A Mailgun request cannot target a different domain than the connection."); } }
  private senderUsesDomain(value: string, domain: string) { const address = value.match(/<([^>]+)>/)?.[1] ?? value; return address.toLowerCase().endsWith(`@${domain.toLowerCase()}`); }
  private rejectSecretFields(value?: JsonObject) { if (!value) return; for (const key of Object.keys(value)) if (/(api.?key|password|secret|authorization|credential|token)/i.test(key)) throw new MailgunApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`); }
  private append(params: URLSearchParams, value?: JsonObject) { if (!value) return; for (const [key, entry] of Object.entries(value)) { if (entry === undefined || entry === null) continue; for (const item of Array.isArray(entry) ? entry : [entry]) params.append(key, typeof item === "object" ? JSON.stringify(item) : String(item)); } }
  private appendForm(form: FormData, value: JsonObject) { for (const [key, entry] of Object.entries(value)) { if (entry === undefined || entry === null) continue; for (const item of Array.isArray(entry) ? entry : [entry]) form.append(key, typeof item === "object" ? JSON.stringify(item) : String(item)); } }
  private redact(value: unknown): unknown { if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redact(item)); if (!value || typeof value !== "object") return value; const result: JsonObject = {}; for (const [key, entry] of Object.entries(value as JsonObject).slice(0, 500)) result[key] = /(api.?key|password|secret|authorization|credential|token)/i.test(key) ? "[REDACTED]" : this.redact(entry); return result; }
  private message(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const object = value as JsonObject; return this.string(object.message) ?? this.string(object.error); }
  private code(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private requiredString(value: unknown, field: string) { const result = this.string(value); if (!result) throw new MailgunApiError("provider_validation_error", `${field} is required`); return result; }
  private string(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
  private stringArray(value: unknown, max: number) { return Array.isArray(value) ? value.map((entry) => this.string(entry)).filter((entry): entry is string => Boolean(entry)).slice(0, max) : []; }
  private clamp(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isFinite(number) ? Math.min(Math.max(Math.floor(number), min), max) : fallback; }
}
