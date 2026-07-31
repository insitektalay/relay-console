import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>; type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_URL = "https://api.evaboot.com/v1/quota/";
export type EvabootCredentials = { apiToken: string };
export class EvabootApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }
@Injectable()
export class EvabootApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: EvabootCredentials) { await this.getQuota(credentials); return { reachable: true }; }
  async getQuota(credentials: EvabootCredentials) {
    const token = this.credentials(credentials); let response: Response;
    try { response = await this.request(API_URL, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new EvabootApiError("provider_unavailable", "Evaboot is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 128_000) throw new EvabootApiError("provider_validation_error", "Evaboot response exceeded the safe size limit.");
    if (!response.ok) throw new EvabootApiError(response.status === 401 ? "credential_missing" : response.status === 402 ? "insufficient_scope" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "Evaboot API request failed.", response.status);
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new EvabootApiError("provider_validation_error", "Evaboot returned an invalid response."); }
    const quota = this.object(body.quota); const accounts = Array.isArray(quota.salesnavs) ? quota.salesnavs.map((item) => this.object(item)) : [];
    return { quota: { dailyLimit: this.number(quota.daily_limit), usedToday: this.number(quota.used_today), remainingToday: this.number(quota.remaining), credits: this.number(quota.credits), salesNavigatorAccounts: { total: accounts.length, valid: accounts.filter((item) => item.status === "valid").length, invalid: accounts.filter((item) => item.status === "invalid").length } } };
  }
  private credentials(credentials: EvabootCredentials) { const token = credentials.apiToken.trim(); if (!token || token.length > 2048) throw new EvabootApiError("credential_missing", "Evaboot API token is missing or invalid."); return token; }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private number(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null; }
}
