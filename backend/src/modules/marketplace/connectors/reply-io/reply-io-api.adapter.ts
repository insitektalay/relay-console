import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>; type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const SEQUENCE_ID = /^[1-9][0-9]{0,14}$/; const API_URL = "https://api.reply.io/v3/sequences";
export type ReplyIoCredentials = { apiKey: string; sequenceId: string };
export class ReplyIoApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }

@Injectable()
export class ReplyIoApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: ReplyIoCredentials) { const result = await this.getSequenceStatus(credentials); if (result.sequence.sequenceId !== credentials.sequenceId) throw new ReplyIoApiError("provider_validation_error", "Reply.io returned a sequence outside the configured binding."); return { sequenceId: credentials.sequenceId, reachable: true }; }
  async getSequenceStatus(credentials: ReplyIoCredentials) {
    const { apiKey, sequenceId } = this.credentials(credentials); let response: Response;
    try { response = await this.request(`${API_URL}/${sequenceId}`, { method: "GET", headers: { Accept: "application/json", "X-API-Key": apiKey, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new ReplyIoApiError("provider_unavailable", "Reply.io is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 512_000) throw new ReplyIoApiError("provider_validation_error", "Reply.io response exceeded the safe size limit.");
    if (!response.ok) throw new ReplyIoApiError(response.status === 401 ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "Reply.io API request failed.", response.status);
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new ReplyIoApiError("provider_validation_error", "Reply.io returned an invalid response."); }
    const row = this.object(body.sequence ?? body); const returnedId = this.id(row.id ?? row.sequenceId);
    if (returnedId !== sequenceId) throw new ReplyIoApiError("provider_validation_error", "Reply.io returned a sequence outside the configured binding.");
    return { sequence: { sequenceId, name: this.text(row.name), createdAt: this.text(row.created), status: this.text(row.status), isArchived: row.isArchived === true } };
  }
  private credentials(c: ReplyIoCredentials) { const apiKey = c.apiKey.trim(); if (!apiKey || apiKey.length > 2048) throw new ReplyIoApiError("credential_missing", "Reply.io API key is missing or invalid."); if (!SEQUENCE_ID.test(c.sequenceId)) throw new ReplyIoApiError("provider_validation_error", "A positive numeric Reply.io sequence ID is required."); return { apiKey, sequenceId: c.sequenceId }; }
  private object(v: unknown): JsonObject { return v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {}; }
  private id(v: unknown) { const value = typeof v === "number" && Number.isSafeInteger(v) ? String(v) : typeof v === "string" ? v : ""; return SEQUENCE_ID.test(value) ? value : null; }
  private text(v: unknown) { return typeof v === "string" ? v.slice(0, 200) : null; }
}
