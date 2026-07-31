import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>; type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const CAMPAIGN_ID = /^[1-9][0-9]{0,14}$/; const API_URL = "https://api.mailshake.com/2017-04-01/campaigns/get";
export type MailshakeCredentials = { apiKey: string; campaignId: string };
export class MailshakeApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }

@Injectable()
export class MailshakeApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: MailshakeCredentials) { const result = await this.getCampaignStatus(credentials); if (result.campaign.campaignId !== credentials.campaignId) throw new MailshakeApiError("provider_validation_error", "Mailshake returned a campaign outside the configured binding."); return { campaignId: credentials.campaignId, reachable: true }; }
  async getCampaignStatus(credentials: MailshakeCredentials) {
    const { apiKey, campaignId } = this.credentials(credentials); let response: Response;
    try { response = await this.request(API_URL, { method: "POST", headers: { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${apiKey}:`, "utf8").toString("base64")}`, "Content-Type": "application/json", "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, body: JSON.stringify({ campaignID: Number(campaignId) }), redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new MailshakeApiError("provider_unavailable", "Mailshake is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 256_000) throw new MailshakeApiError("provider_validation_error", "Mailshake response exceeded the safe size limit.");
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new MailshakeApiError("provider_validation_error", "Mailshake returned an invalid response."); }
    if (!response.ok) throw new MailshakeApiError(this.errorCode(response.status, this.text(body.code)), "Mailshake API request failed.", response.status);
    const row = this.object(body.campaign ?? body); const returnedId = this.id(row.id ?? row.campaignID);
    if (returnedId !== campaignId) throw new MailshakeApiError("provider_validation_error", "Mailshake returned a campaign outside the configured binding.");
    return { campaign: { campaignId, title: this.text(row.title), createdAt: this.text(row.created), isArchived: row.isArchived === true, isPaused: row.isPaused === true, messageCount: Array.isArray(row.messages) ? Math.min(row.messages.length, 500) : null } };
  }
  private credentials(c: MailshakeCredentials) { const apiKey = c.apiKey.trim(); if (!apiKey || apiKey.length > 2048) throw new MailshakeApiError("credential_missing", "Mailshake API key is missing or invalid."); if (!CAMPAIGN_ID.test(c.campaignId)) throw new MailshakeApiError("provider_validation_error", "A positive numeric Mailshake campaign ID is required."); return { apiKey, campaignId: c.campaignId }; }
  private errorCode(status: number, providerCode: string | null): MarketplaceConnectorSafeErrorCode { if (status === 401 || providerCode === "invalid_api_key") return "credential_missing"; if (status === 403 || providerCode === "not_authorized" || providerCode === "missing_subscription" || providerCode === "team_blocked") return "insufficient_scope"; if (status === 429 || providerCode === "limit_reached") return "provider_rate_limited"; return status >= 500 || providerCode === "internal_error" ? "provider_unavailable" : "provider_validation_error"; }
  private object(v: unknown): JsonObject { return v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {}; }
  private id(v: unknown) { const value = typeof v === "number" && Number.isSafeInteger(v) ? String(v) : typeof v === "string" ? v : ""; return CAMPAIGN_ID.test(value) ? value : null; }
  private text(v: unknown) { return typeof v === "string" ? v.slice(0, 200) : null; }
}
