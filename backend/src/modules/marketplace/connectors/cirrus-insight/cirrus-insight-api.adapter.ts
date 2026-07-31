import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>; type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i; const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; const API_URL = "https://api.cirrusinsight.com/api/organizations";
export type CirrusInsightCredentials = { organizationId: string; userEmail: string };
export class CirrusInsightApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }

@Injectable()
export class CirrusInsightApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: CirrusInsightCredentials) { const result = await this.getSchedulingLinks(credentials); return { reachable: true, calendarCount: result.calendars.length }; }
  async getSchedulingLinks(credentials: CirrusInsightCredentials) {
    const { organizationId, userEmail } = this.credentials(credentials); let response: Response;
    try { response = await this.request(`${API_URL}/${organizationId}/calendarviews?emails=${encodeURIComponent(userEmail)}`, { method: "GET", headers: { Accept: "application/json", "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new CirrusInsightApiError("provider_unavailable", "Cirrus Insight is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 256_000) throw new CirrusInsightApiError("provider_validation_error", "Cirrus Insight response exceeded the safe size limit.");
    if (!response.ok) throw new CirrusInsightApiError(response.status === 401 ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "Cirrus Insight API request failed.", response.status);
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new CirrusInsightApiError("provider_validation_error", "Cirrus Insight returned an invalid response."); }
    const status = this.text(body.status ?? body.Status); if (status && status.toLowerCase() !== "success") throw new CirrusInsightApiError("provider_validation_error", "Cirrus Insight did not accept the configured organization and user binding.");
    const rows = Array.isArray(body.calendarViews) ? body.calendarViews.map((item) => this.object(item)) : [];
    const row = rows.find((item) => this.email(item.email) === userEmail); if (rows.length > 0 && !row) throw new CirrusInsightApiError("provider_validation_error", "Cirrus Insight returned calendars outside the configured user binding.");
    const calendars = (row && Array.isArray(row.calendars) ? row.calendars : []).slice(0, 10).map((item) => this.calendar(item));
    return { calendars };
  }
  private credentials(c: CirrusInsightCredentials) { const organizationId = c.organizationId.trim().toLowerCase(); const userEmail = c.userEmail.trim().toLowerCase(); if (!UUID.test(organizationId)) throw new CirrusInsightApiError("credential_missing", "A valid Cirrus Insight organization UUID is required."); if (!EMAIL.test(userEmail) || userEmail.length > 254) throw new CirrusInsightApiError("credential_missing", "A valid exact Cirrus Insight user email is required."); return { organizationId, userEmail }; }
  private object(v: unknown): JsonObject { return v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {}; }
  private email(v: unknown) { return typeof v === "string" && v.length <= 254 ? v.toLowerCase() : null; }
  private text(v: unknown) { return typeof v === "string" ? v.slice(0, 200) : null; }
  private calendar(v: unknown) { const row = this.object(v); const url = typeof row.url === "string" && row.url.length <= 2048 ? row.url : ""; let parsed: URL; try { parsed = new URL(url); } catch { throw new CirrusInsightApiError("provider_validation_error", "Cirrus Insight returned an invalid scheduling link."); } if (parsed.protocol !== "https:") throw new CirrusInsightApiError("provider_validation_error", "Cirrus Insight returned a non-HTTPS scheduling link."); return { name: this.text(row.name), url: parsed.toString(), isPrimary: row.isPrimary === true }; }
}
