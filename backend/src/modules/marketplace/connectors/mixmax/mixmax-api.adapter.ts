import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>; type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const SEQUENCE_ID = /^[a-f0-9]{24}$/i; const API_URL = "https://api.mixmax.com/v1/sequences";
export type MixmaxCredentials = { apiToken: string; sequenceId: string };
export class MixmaxApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }

@Injectable()
export class MixmaxApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: MixmaxCredentials) { const result = await this.getSequenceSummary(credentials); if (result.sequence.sequenceId !== credentials.sequenceId.toLowerCase()) throw new MixmaxApiError("provider_validation_error", "Mixmax returned a sequence outside the configured binding."); return { sequenceId: result.sequence.sequenceId, reachable: true }; }
  async getSequenceSummary(credentials: MixmaxCredentials) {
    const { apiToken, sequenceId } = this.credentials(credentials); let response: Response;
    try { response = await this.request(`${API_URL}/${sequenceId}`, { method: "GET", headers: { Accept: "application/json", "X-API-Token": apiToken, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new MixmaxApiError("provider_unavailable", "Mixmax is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 512_000) throw new MixmaxApiError("provider_validation_error", "Mixmax response exceeded the safe size limit.");
    if (!response.ok) throw new MixmaxApiError(response.status === 401 ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "Mixmax API request failed.", response.status);
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new MixmaxApiError("provider_validation_error", "Mixmax returned an invalid response."); }
    const row = this.object(body.sequence ?? body); const returnedId = this.id(row._id ?? row.id);
    if (returnedId !== sequenceId) throw new MixmaxApiError("provider_validation_error", "Mixmax returned a sequence outside the configured binding.");
    return { sequence: { sequenceId, name: this.text(row.name), createdAt: this.text(row.createdAt), updatedAt: this.text(row.updatedAt) } };
  }
  private credentials(c: MixmaxCredentials) { const apiToken = c.apiToken.trim(); const sequenceId = c.sequenceId.trim().toLowerCase(); if (!apiToken || apiToken.length > 2048) throw new MixmaxApiError("credential_missing", "Mixmax API token is missing or invalid."); if (!SEQUENCE_ID.test(sequenceId)) throw new MixmaxApiError("provider_validation_error", "A 24-character hexadecimal Mixmax sequence ID is required."); return { apiToken, sequenceId }; }
  private object(v: unknown): JsonObject { return v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {}; }
  private id(v: unknown) { const value = typeof v === "string" ? v.toLowerCase() : ""; return SEQUENCE_ID.test(value) ? value : null; }
  private text(v: unknown) { return typeof v === "string" ? v.slice(0, 200) : null; }
}
