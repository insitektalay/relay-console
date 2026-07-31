import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>; type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const CAMPAIGN_ID = /^[1-9][0-9]{0,14}$/; const API_URL = "https://api.woodpecker.co/rest/v2/campaigns";
export type WoodpeckerCredentials = { apiKey: string; campaignId: string };
export class WoodpeckerApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }

@Injectable()
export class WoodpeckerApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: WoodpeckerCredentials) { const result = await this.getCampaignStatus(credentials); if (result.campaign.campaignId !== credentials.campaignId) throw new WoodpeckerApiError("provider_validation_error", "Woodpecker returned a campaign outside the configured binding."); return { campaignId: credentials.campaignId, reachable: true }; }
  async getCampaignStatus(credentials: WoodpeckerCredentials) {
    const { apiKey, campaignId } = this.credentials(credentials); let response: Response;
    try { response = await this.request(`${API_URL}/${campaignId}`, { method: "GET", headers: { Accept: "application/json", "x-api-key": apiKey, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new WoodpeckerApiError("provider_unavailable", "Woodpecker is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 512_000) throw new WoodpeckerApiError("provider_validation_error", "Woodpecker response exceeded the safe size limit.");
    if (!response.ok) throw new WoodpeckerApiError(response.status === 401 ? "credential_missing" : response.status === 403 || response.status === 409 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "Woodpecker API request failed.", response.status);
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new WoodpeckerApiError("provider_validation_error", "Woodpecker returned an invalid response."); }
    const row = this.object(body.campaign ?? body); const returnedId = this.id(row.id ?? row.campaign_id);
    if (returnedId !== campaignId) throw new WoodpeckerApiError("provider_validation_error", "Woodpecker returned a campaign outside the configured binding.");
    return { campaign: { campaignId, name: this.text(row.name), status: this.text(row.status), bounceShieldAutoPaused: typeof row.bounce_shield_autopaused_at === "string" && row.bounce_shield_autopaused_at.length > 0 } };
  }
  private credentials(c: WoodpeckerCredentials) { const apiKey = c.apiKey.trim(); if (!apiKey || apiKey.length > 2048) throw new WoodpeckerApiError("credential_missing", "Woodpecker API key is missing or invalid."); if (!CAMPAIGN_ID.test(c.campaignId)) throw new WoodpeckerApiError("provider_validation_error", "A positive numeric Woodpecker campaign ID is required."); return { apiKey, campaignId: c.campaignId }; }
  private object(v: unknown): JsonObject { return v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {}; }
  private id(v: unknown) { const value = typeof v === "number" && Number.isSafeInteger(v) ? String(v) : typeof v === "string" ? v : ""; return CAMPAIGN_ID.test(value) ? value : null; }
  private text(v: unknown) { return typeof v === "string" ? v.slice(0, 200) : null; }
}
