import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_URL = "https://v3-api.texau.com/api/v1/texau-identify-email-type";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type TexAuCredentials = { apiKey: string };
export class TexAuApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }

@Injectable()
export class TexAuApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: TexAuCredentials) { this.credentials(credentials); return { configured: true, liveValidation: "deferred_to_approved_action" }; }
  async identifyEmailType(credentials: TexAuCredentials, input: Record<string, unknown>) {
    const { apiKey } = this.credentials(credentials); const email = this.email(input.email); let response: Response;
    try { response = await this.request(API_URL, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "x-api-key": apiKey, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, body: JSON.stringify({ email }), redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new TexAuApiError("provider_unavailable", "TexAu is temporarily unavailable.", 502); }
    const raw = await response.text(); if (Buffer.byteLength(raw, "utf8") > 128_000) throw new TexAuApiError("provider_validation_error", "TexAu response exceeded the safe size limit.");
    if (!response.ok) throw new TexAuApiError(response.status === 401 ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "TexAu API request failed.", response.status);
    let body: JsonObject; try { body = this.object(raw ? JSON.parse(raw) : {}); } catch { throw new TexAuApiError("provider_validation_error", "TexAu returned an invalid response."); }
    const data = this.object(body.data); const provider = [["is_gmail", "gmail"], ["is_hotmail", "hotmail"], ["is_i_cloud", "icloud"], ["is_proton_mail", "proton_mail"], ["is_yahoo", "yahoo"], ["is_yandex", "yandex"]].find(([key]) => data[key] === true)?.[1] ?? null;
    const classification = data.is_likely_company_email === true ? "company" : data.is_likely_education_email === true ? "education" : data.is_likely_personal_email === true ? "personal" : "unknown";
    return { classification: { type: classification, publicEmailProvider: provider, likelyCompany: data.is_likely_company_email === true, likelyEducation: data.is_likely_education_email === true, likelyPersonal: data.is_likely_personal_email === true } };
  }
  private credentials(credentials: TexAuCredentials) { const apiKey = credentials.apiKey.trim(); if (!apiKey || apiKey.length > 2048) throw new TexAuApiError("credential_missing", "TexAu API key is missing or invalid."); return { apiKey }; }
  private email(value: unknown) { const email = typeof value === "string" ? value.trim().toLowerCase() : ""; if (email.length < 3 || email.length > 254 || !EMAIL.test(email)) throw new TexAuApiError("provider_validation_error", "A valid email address is required."); return email; }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
}
