import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>; type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const CAMPAIGN_ID = /^cam_[A-Za-z0-9]{8,80}$/; const API_URL = "https://api.lemlist.com/api/campaigns";
export type LemlistCredentials = { apiKey: string; campaignId: string };
export class LemlistApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }

@Injectable()
export class LemlistApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: LemlistCredentials) { const result = await this.getCampaignStatus(credentials); if (result.campaign.campaignId !== credentials.campaignId) throw new LemlistApiError("provider_validation_error", "lemlist returned a campaign outside the configured binding."); return { campaignId: credentials.campaignId, reachable: true }; }
  async getCampaignStatus(credentials: LemlistCredentials) {
    const { apiKey, campaignId } = this.credentials(credentials); let response: Response;
    try { response = await this.request(`${API_URL}/${campaignId}`, { method: "GET", headers: { Accept: "application/json", Authorization: `Basic ${Buffer.from(`:${apiKey}`, "utf8").toString("base64")}`, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new LemlistApiError("provider_unavailable", "lemlist is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 256_000) throw new LemlistApiError("provider_validation_error", "lemlist response exceeded the safe size limit.");
    if (!response.ok) throw new LemlistApiError(response.status === 401 ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 404 ? "provider_validation_error" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "lemlist API request failed.", response.status);
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new LemlistApiError("provider_validation_error", "lemlist returned an invalid response."); }
    const row = this.object(body.data ?? body.campaign ?? body); const returnedId = this.id(row._id ?? row.id ?? row.campaignId);
    if (returnedId !== campaignId) throw new LemlistApiError("provider_validation_error", "lemlist returned a campaign outside the configured binding.");
    return { campaign: { campaignId, name: this.text(row.name), status: this.text(row.status), createdAt: this.text(row.createdAt), hasError: Array.isArray(row.errors) ? row.errors.length > 0 : row.hasError === true } };
  }
  private credentials(c: LemlistCredentials) { const apiKey = c.apiKey.trim(); if (!apiKey || apiKey.length > 2048) throw new LemlistApiError("credential_missing", "lemlist API key is missing or invalid."); if (!CAMPAIGN_ID.test(c.campaignId)) throw new LemlistApiError("provider_validation_error", "A valid cam_ lemlist campaign ID is required."); return { apiKey, campaignId: c.campaignId }; }
  private object(v: unknown): JsonObject { return v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {}; }
  private id(v: unknown) { return typeof v === "string" && CAMPAIGN_ID.test(v) ? v : null; }
  private text(v: unknown) { return typeof v === "string" ? v.slice(0, 200) : null; }
}
