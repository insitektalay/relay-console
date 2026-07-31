import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>; type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const ID = /^[1-9][0-9]{0,24}$/; const API_URL = "https://api.phantombuster.com/api/v2/agents/fetch";
export type PhantomBusterCredentials = { apiKey: string; agentId: string };
export class PhantomBusterApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }
@Injectable()
export class PhantomBusterApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: PhantomBusterCredentials) { const agent = await this.getAgentStatus(credentials); if (agent.agent.agentId !== credentials.agentId) throw new PhantomBusterApiError("provider_validation_error", "PhantomBuster returned an Agent outside the configured binding."); return { agentId: credentials.agentId, reachable: true }; }
  async getAgentStatus(credentials: PhantomBusterCredentials) {
    const { apiKey, agentId } = this.credentials(credentials); let response: Response;
    try { response = await this.request(`${API_URL}?id=${agentId}`, { method: "GET", headers: { Accept: "application/json", "X-Phantombuster-Key": apiKey, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new PhantomBusterApiError("provider_unavailable", "PhantomBuster is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 512_000) throw new PhantomBusterApiError("provider_validation_error", "PhantomBuster response exceeded the safe size limit.");
    if (!response.ok) throw new PhantomBusterApiError(response.status === 401 ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "PhantomBuster API request failed.", response.status);
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new PhantomBusterApiError("provider_validation_error", "PhantomBuster returned an invalid response."); }
    const row = this.object(body.data ?? body.agent ?? body); const returnedId = this.id(row.id ?? row.agentId);
    if (returnedId !== agentId) throw new PhantomBusterApiError("provider_validation_error", "PhantomBuster returned an Agent outside the configured binding.");
    return { agent: { agentId, name: this.text(row.name ?? row.displayName), status: this.text(row.status), lastEndStatus: this.text(row.lastEndStatus), lastStart: this.number(row.lastStart), lastEnd: this.number(row.lastEnd), launchDuration: this.number(row.launchDuration), queued: row.queued === true, running: row.running === true } };
  }
  private credentials(c: PhantomBusterCredentials) { const apiKey = c.apiKey.trim(); if (!apiKey || apiKey.length > 2048) throw new PhantomBusterApiError("credential_missing", "PhantomBuster API key is missing or invalid."); if (!ID.test(c.agentId)) throw new PhantomBusterApiError("provider_validation_error", "A positive numeric PhantomBuster Agent ID is required."); return { apiKey, agentId: c.agentId }; }
  private object(v: unknown): JsonObject { return v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {}; }
  private id(v: unknown) { const s = typeof v === "number" && Number.isSafeInteger(v) ? String(v) : typeof v === "string" ? v : ""; return ID.test(s) ? s : null; }
  private text(v: unknown) { return typeof v === "string" ? v.slice(0, 200) : null; }
  private number(v: unknown) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
}
