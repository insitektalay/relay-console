import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_URL = "https://api.clay.com/public/v0/me";
const OPAQUE_ID = /^[A-Za-z0-9_-]{1,200}$/;
export type ClayCredentials = { apiKey: string };
export class ClayApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); } }

@Injectable()
export class ClayApiAdapter {
  constructor(@Optional() private readonly request: HttpClient = fetch) {}
  async health(credentials: ClayCredentials) { const workspace = this.summary(await this.send(credentials)); if (!workspace.workspaceId) throw new ClayApiError("provider_validation_error", "Clay did not return the API-key-bound workspace."); return { workspaceId: workspace.workspaceId, reachable: true }; }
  async getWorkspace(credentials: ClayCredentials) { return { workspace: this.summary(await this.send(credentials)) }; }
  private async send(credentials: ClayCredentials) {
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 2048) throw new ClayApiError("credential_missing", "Clay Public API key is missing or invalid.");
    let response: Response;
    try { response = await this.request(API_URL, { method: "GET", headers: { Accept: "application/json", "clay-api-key": apiKey, "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new ClayApiError("provider_unavailable", "Clay is temporarily unavailable.", 502); }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 256_000) throw new ClayApiError("provider_validation_error", "Clay response exceeded the safe size limit.");
    if (!response.ok) throw new ClayApiError(response.status === 401 ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "Clay Public API request failed.", response.status);
    try { return this.object(raw ? JSON.parse(raw) : {}); } catch { throw new ClayApiError("provider_validation_error", "Clay returned an invalid response."); }
  }
  private summary(body: JsonObject) {
    const workspace = this.object(body.workspace ?? body.currentWorkspace);
    const user = this.object(body.user ?? body.currentUser);
    return { workspaceId: this.id(workspace.id ?? body.workspaceId ?? body.workspace_id), workspaceName: this.text(workspace.name ?? body.workspaceName ?? body.workspace_name), userId: this.id(user.id ?? body.userId ?? body.user_id) };
  }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private id(value: unknown) { const id = typeof value === "string" ? value : ""; return OPAQUE_ID.test(id) ? id : null; }
  private text(value: unknown) { return typeof value === "string" ? value.slice(0, 200) : null; }
}
