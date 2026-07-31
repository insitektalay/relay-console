import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type PostmarkCredentials = { serverToken: string; accountToken?: string; senderBoundary: string; messageStream: string };

export class PostmarkApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class PostmarkApiAdapter {
  health(credentials: PostmarkCredentials) { return this.getServer(credentials); }
  getServer(credentials: PostmarkCredentials) { return this.request(credentials, { authority: "server", method: "GET", path: "/server" }); }
  listMessageStreams(credentials: PostmarkCredentials) { return this.request(credentials, { authority: "server", method: "GET", path: "/message-streams", query: { MessageStreamType: "All", IncludeArchivedStreams: false } }); }
  getOutboundStats(credentials: PostmarkCredentials, input: JsonObject) { return this.request(credentials, { authority: "server", method: "GET", path: "/stats/outbound", query: { fromdate: input.fromDate, todate: input.toDate, tag: input.tag } }); }
  sendEmail(credentials: PostmarkCredentials, input: JsonObject) {
    const message = this.object(input.message); if (!message) throw new PostmarkApiError("provider_validation_error", "message is required");
    const from = this.string(message.From); if (!from || !this.senderAllowed(from, credentials.senderBoundary)) throw new PostmarkApiError("sender_identity_not_approved", `From must match ${credentials.senderBoundary}.`);
    const stream = this.string(message.MessageStream) ?? credentials.messageStream; if (stream !== credentials.messageStream) throw new PostmarkApiError("policy_blocked", `MessageStream must be ${credentials.messageStream}.`); message.MessageStream = stream;
    const recipients = [message.To, message.Cc, message.Bcc].flatMap((value) => this.string(value)?.split(",") ?? []).filter((value) => value.trim()).length;
    if (recipients < 1 || recipients > 50) throw new PostmarkApiError("provider_validation_error", "Postmark email must contain 1 to 50 recipients.");
    if (Buffer.byteLength(JSON.stringify(message)) > 10 * 1024 * 1024) throw new PostmarkApiError("provider_validation_error", "Postmark single-email payload exceeds 10 MB.");
    return this.request(credentials, { authority: "server", method: "POST", path: "/email", json: message });
  }

  async request(credentials: PostmarkCredentials, input: { authority?: "server" | "account"; method: string; path: string; query?: JsonObject; json?: JsonObject | unknown[] }) {
    const method = input.method.toUpperCase(); const authority = input.authority ?? "server";
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) || !input.path.startsWith("/") || input.path.startsWith("//") || input.path.includes("..") || input.path.includes("://")) throw new PostmarkApiError("provider_validation_error", "Postmark method or path is invalid.");
    this.rejectSecretFields(input.query); this.rejectSecretFields(input.json);
    const encodedBody = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (input.path === "/email/batch" && (!Array.isArray(input.json) || input.json.length < 1 || input.json.length > 500)) throw new PostmarkApiError("provider_validation_error", "Postmark batch email requires 1 to 500 messages.");
    if (encodedBody && Buffer.byteLength(encodedBody) > 50 * 1024 * 1024) throw new PostmarkApiError("provider_validation_error", "Postmark request payload exceeds 50 MB.");
    const token = authority === "account" ? credentials.accountToken : credentials.serverToken;
    if (!token) throw new PostmarkApiError("credential_missing", "This operation requires the optional Postmark account token.");
    const url = new URL(`https://api.postmarkapp.com${input.path}`); this.append(url.searchParams, input.query);
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json", [authority === "account" ? "X-Postmark-Account-Token" : "X-Postmark-Server-Token"]: token };
    const response = await safeConnectorFetch(url, { method, headers, body: encodedBody });
    const raw = await response.text(); const text = raw.slice(0, 512_000); let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    const safe = this.redact(parsed); const providerError = this.providerError(safe);
    if (!response.ok || providerError) throw new PostmarkApiError(this.code(response.status, providerError), providerError ?? `Postmark returned ${response.status}`, response.status);
    return { status: response.status, data: safe, truncated: raw.length > text.length };
  }

  private senderAllowed(value: string, boundary: string) { const email = value.match(/<([^>]+)>/)?.[1] ?? value; const normalized = boundary.toLowerCase().replace(/^@/, ""); return normalized.includes("@") ? email.toLowerCase() === normalized : email.toLowerCase().endsWith(`@${normalized}`); }
  private providerError(value: unknown) { const object = this.object(value); if (!object || Number(object.ErrorCode ?? 0) === 0) return null; return this.string(object.Message) ?? `Postmark error ${object.ErrorCode}`; }
  private rejectSecretFields(value?: JsonObject | unknown[]) { if (!value) return; const walk = (entry: unknown) => { if (Array.isArray(entry)) return entry.forEach(walk); const object = this.object(entry); if (!object) return; for (const [key, child] of Object.entries(object)) { if (/(api.?token|account.?token|server.?token|password|secret|authorization|credential)/i.test(key)) throw new PostmarkApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`); walk(child); } }; walk(value); }
  private append(params: URLSearchParams, value?: JsonObject) { if (!value) return; for (const [key, entry] of Object.entries(value)) if (entry !== undefined && entry !== null) params.append(key, String(entry)); }
  private redact(value: unknown): unknown { if (Array.isArray(value)) return value.slice(0, 500).map((entry) => this.redact(entry)); const object = this.object(value); if (!object) return value; const result: JsonObject = {}; for (const [key, entry] of Object.entries(object).slice(0, 500)) result[key] = /(api.?tokens?|account.?token|server.?token|password|secret|authorization|credential)/i.test(key) ? "[REDACTED]" : this.redact(entry); return result; }
  private code(status: number, providerError: string | null): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return providerError ? "provider_validation_error" : "provider_validation_error"; }
  private string(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
  private object(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
}
