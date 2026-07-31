import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHmac, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type InstapaperCredentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
  instaparserApiKey?: string;
};

export class InstapaperApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class InstapaperApiAdapter {
  async exchangeXAuth(credentials: InstapaperCredentials, username: string, password: string) {
    if (!username.trim()) throw new InstapaperApiError("provider_validation_error", "Instapaper username is required.");
    const raw = await this.requestRaw(credentials, "/api/1/oauth/access_token", {
      x_auth_username: username,
      x_auth_password: password,
      x_auth_mode: "client_auth",
    });
    const result = new URLSearchParams(raw);
    const accessToken = result.get("oauth_token") ?? "";
    const accessTokenSecret = result.get("oauth_token_secret") ?? "";
    if (!accessToken || !accessTokenSecret) throw new InstapaperApiError("provider_validation_error", "Instapaper xAuth did not return a token and secret.");
    return { accessToken, accessTokenSecret };
  }

  verifyAccount(credentials: InstapaperCredentials) { return this.request(credentials, "/api/1/account/verify_credentials"); }
  listFolders(credentials: InstapaperCredentials) { return this.request(credentials, "/api/1/folders/list"); }
  listBookmarks(credentials: InstapaperCredentials, input: JsonObject) {
    return this.request(credentials, "/api/1/bookmarks/list", {
      limit: this.clamp(input.limit, 25, 1, 100),
      folder_id: this.optionalString(input.folderId, 100),
      tag: this.optionalString(input.tag, 200),
    });
  }
  listHighlights(credentials: InstapaperCredentials, input: JsonObject) {
    const bookmarkId = this.integer(input.bookmarkId, "bookmarkId");
    return this.request(credentials, `/api/1.1/bookmarks/${bookmarkId}/highlights`);
  }

  async request(credentials: InstapaperCredentials, path: string, fields: JsonObject = {}) {
    this.validatePath(path);
    this.rejectCredentialFields(fields);
    const normalized: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null || value === "") continue;
      normalized[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    if (path === "/api/1/bookmarks/get_text") {
      if (!credentials.instaparserApiKey) throw new InstapaperApiError("credential_missing", "A customer-owned Instaparser API key is required for non-personal get_text use.");
      normalized.instaparser_api_key = credentials.instaparserApiKey;
    }
    const raw = await this.requestRaw(credentials, path, normalized);
    if (path === "/api/1/bookmarks/get_text") return { html: raw.slice(0, 2_000_000) };
    try { return this.redact(JSON.parse(raw)); } catch { throw new InstapaperApiError("provider_unavailable", "Instapaper returned a non-JSON response."); }
  }

  private async requestRaw(credentials: InstapaperCredentials, path: string, fields: Record<string, string | number>) {
    this.validatePath(path);
    if (!credentials.consumerKey || !credentials.consumerSecret) throw new InstapaperApiError("credential_missing", "Instapaper Relay-owned consumer credentials are not configured.");
    const url = `https://www.instapaper.com${path}`;
    const oauth: Record<string, string> = {
      oauth_consumer_key: credentials.consumerKey,
      oauth_nonce: randomBytes(18).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_version: "1.0",
      ...(credentials.accessToken ? { oauth_token: credentials.accessToken } : {}),
    };
    const signatureParameters: Record<string, string> = { ...oauth };
    for (const [key, value] of Object.entries(fields)) signatureParameters[key] = String(value);
    const parameterString = Object.entries(signatureParameters).sort(([a, av], [b, bv]) => a === b ? av.localeCompare(bv) : a.localeCompare(b)).map(([key, value]) => `${this.encode(key)}=${this.encode(value)}`).join("&");
    const base = `POST&${this.encode(url)}&${this.encode(parameterString)}`;
    const signingKey = `${this.encode(credentials.consumerSecret)}&${this.encode(credentials.accessTokenSecret ?? "")}`;
    oauth.oauth_signature = createHmac("sha1", signingKey).update(base).digest("base64");
    const authorization = `OAuth ${Object.entries(oauth).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${this.encode(key)}="${this.encode(value)}"`).join(", ")}`;
    const body = new URLSearchParams(Object.entries(fields).map(([key, value]) => [key, String(value)])).toString();
    const response = await safeConnectorFetch(url, { method: "POST", headers: { Authorization: authorization, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body, redirect: "error", signal: AbortSignal.timeout(20_000) });
    const raw = await response.text();
    if (raw.length > 2_000_000) throw new InstapaperApiError("provider_validation_error", "Instapaper response exceeds 2 MB.");
    if (!response.ok) throw new InstapaperApiError(this.code(response.status), this.safeMessage(raw, response.status), response.status);
    return raw;
  }

  private validatePath(path: string) {
    if (!/^\/api\/1(?:\.1)?\/[A-Za-z0-9_./{}-]+$/.test(path) || path.includes("..") || path.includes("//") || path.includes("{") || path.includes("}")) throw new InstapaperApiError("provider_validation_error", "Instapaper API path is invalid.");
  }
  private rejectCredentialFields(value: JsonObject) {
    const walk = (input: unknown, depth = 0) => { if (depth > 10) throw new InstapaperApiError("policy_blocked", "Instapaper request is too deeply nested."); if (Array.isArray(input)) return input.forEach((item) => walk(item, depth + 1)); if (!input || typeof input !== "object") return; for (const [key, child] of Object.entries(input as JsonObject)) { if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new InstapaperApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`); walk(child, depth + 1); } }; walk(value);
  }
  private redact(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 500_000); if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, child]) => [key, /(token|secret|password|authorization|cookie)/i.test(key) ? "[redacted]" : this.redact(child, depth + 1)])); }
  private safeMessage(raw: string, status: number) { try { const parsed = JSON.parse(raw); const first = Array.isArray(parsed) ? parsed[0] : parsed; if (first && typeof first.message === "string") return first.message.slice(0, 500); } catch {} return `Instapaper returned HTTP ${status}.`; }
  private code(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401 || status === 403) return "credential_missing"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private encode(value: string) { return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`); }
  private clamp(value: unknown, fallback: number, minimum: number, maximum: number) { const number = Number(value ?? fallback); return Number.isFinite(number) ? Math.min(Math.max(Math.floor(number), minimum), maximum) : fallback; }
  private integer(value: unknown, name: string) { const number = Number(value); if (!Number.isSafeInteger(number) || number < 1) throw new InstapaperApiError("provider_validation_error", `${name} must be a positive safe integer.`); return number; }
  private optionalString(value: unknown, maximum: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : undefined; }
}
