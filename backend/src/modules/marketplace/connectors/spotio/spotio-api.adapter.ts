import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_ORIGIN = "https://api.spotio2.com";
const DATA_OBJECT_ID = /^[a-f0-9]{24}$/i;

export type SpotioCredentials = { clientId: string; clientSecret: string; dataObjectId: string };
export class SpotioApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); }
}

@Injectable()
export class SpotioApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}

  async health(credentials: SpotioCredentials) {
    const result = await this.getDataObjectSummary(credentials);
    if (result.dataObject.dataObjectId !== credentials.dataObjectId.trim().toLowerCase()) throw new SpotioApiError("provider_validation_error", "SPOTIO returned a data object outside the configured binding.");
    return { dataObjectId: result.dataObject.dataObjectId, reachable: true };
  }

  async getDataObjectSummary(credentials: SpotioCredentials) {
    const checked = this.credentials(credentials);
    const accessToken = await this.createBearerToken(checked);
    const body = await this.send(`${API_ORIGIN}/api/DataObjects/${checked.dataObjectId}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    }, 512_000);
    const row = this.object(body.dataObject ?? body);
    const returnedId = this.id(row.id);
    if (returnedId !== checked.dataObjectId) throw new SpotioApiError("provider_validation_error", "SPOTIO returned a data object outside the configured binding.");
    return { dataObject: {
      dataObjectId: checked.dataObjectId,
      typeId: this.text(row.typeId),
      stageId: this.text(row.stageId),
      source: this.text(row.source),
      createdAt: this.text(row.createdAt),
      updatedAt: this.text(row.updatedAt),
      stageUpdatedAt: this.text(row.stageUpdatedAt),
      visitsCount: this.count(row.visitsCount),
      callsCount: this.count(row.callsCount ?? row.callCount),
    } };
  }

  private async createBearerToken(credentials: SpotioCredentials) {
    const body = await this.send(`${API_ORIGIN}/api/users/apitoken`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" },
      body: JSON.stringify({ clientId: credentials.clientId, secret: credentials.clientSecret }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    }, 64_000, true);
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    if (!accessToken || accessToken.length > 10_000) throw new SpotioApiError("provider_validation_error", "SPOTIO returned an invalid authentication response.");
    return accessToken;
  }

  private async send(url: string, init: RequestInit, maxBytes: number, authenticating = false) {
    let response: Response;
    try { response = await this.request(url, init); }
    catch { throw new SpotioApiError("provider_unavailable", "SPOTIO is temporarily unavailable.", 502); }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > maxBytes) throw new SpotioApiError("provider_validation_error", "SPOTIO response exceeded the safe size limit.");
    if (!response.ok) {
      const code = response.status === 401 || (authenticating && response.status === 400) ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error";
      throw new SpotioApiError(code, "SPOTIO API request failed.", response.status);
    }
    try { return this.object(raw ? JSON.parse(raw) : {}); }
    catch { throw new SpotioApiError("provider_validation_error", "SPOTIO returned an invalid response."); }
  }

  private credentials(value: SpotioCredentials) {
    const clientId = value.clientId?.trim(); const clientSecret = value.clientSecret?.trim(); const dataObjectId = value.dataObjectId?.trim().toLowerCase();
    if (!clientId || !clientSecret || clientId.length > 4_096 || clientSecret.length > 10_000) throw new SpotioApiError("credential_missing", "SPOTIO Client ID or Secret is missing or invalid.");
    if (!DATA_OBJECT_ID.test(dataObjectId)) throw new SpotioApiError("provider_validation_error", "A 24-character hexadecimal SPOTIO data-object ID is required.");
    return { clientId, clientSecret, dataObjectId };
  }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private id(value: unknown) { const id = typeof value === "string" ? value.toLowerCase() : ""; return DATA_OBJECT_ID.test(id) ? id : null; }
  private text(value: unknown) { return typeof value === "string" ? value.slice(0, 200) : null; }
  private count(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000) : null; }
}
