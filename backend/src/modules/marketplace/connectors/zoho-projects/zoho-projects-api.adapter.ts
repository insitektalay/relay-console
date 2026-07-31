import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const ID = /^[1-9][0-9]{0,24}$/;
const API_ORIGINS = new Set(["https://www.zohoapis.com", "https://www.zohoapis.eu", "https://www.zohoapis.in", "https://www.zohoapis.com.au", "https://www.zohoapis.jp", "https://www.zohoapis.ca"]);
export type ZohoProjectsCredentials = { accessToken: string; apiOrigin: string; portalId: string };
export class ZohoProjectsApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); }
}

@Injectable()
export class ZohoProjectsApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}
  async health(credentials: ZohoProjectsCredentials) {
    const body = await this.send(credentials, "/projects/v3/portals");
    const exact = this.rows(body, "portals").find((row) => this.id(row.id) === credentials.portalId);
    if (!exact) throw new ZohoProjectsApiError("provider_validation_error", "Zoho Projects did not return the bound portal.");
    return { portalId: credentials.portalId, portalName: this.text(exact.name), reachable: true };
  }
  async listProjects(credentials: ZohoProjectsCredentials, input: Record<string, unknown>) {
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, `/projects/v3/portal/${credentials.portalId}/projects?page=1&per_page=${limit}`);
    return { portalId: credentials.portalId, projects: this.rows(body, "projects").slice(0, limit).map((row) => this.project(row)), nextPageFollowed: false };
  }
  async listTasks(credentials: ZohoProjectsCredentials, input: Record<string, unknown>) {
    const projectId = this.requiredId(input.projectId, "project");
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, `/projects/v3/portal/${credentials.portalId}/projects/${projectId}/tasks?page=1&per_page=${limit}`);
    return { portalId: credentials.portalId, projectId, tasks: this.rows(body, "tasks").slice(0, limit).map((row) => this.task(row)), nextPageFollowed: false };
  }
  async getTask(credentials: ZohoProjectsCredentials, input: Record<string, unknown>) {
    const projectId = this.requiredId(input.projectId, "project");
    const taskId = this.requiredId(input.taskId, "task");
    const body = await this.send(credentials, `/projects/v3/portal/${credentials.portalId}/projects/${projectId}/tasks/${taskId}`);
    return { portalId: credentials.portalId, projectId, task: this.task(this.unwrap(body, "task")) };
  }
  private async send(credentials: ZohoProjectsCredentials, path: string) {
    const validated = this.credentials(credentials);
    let response: Response;
    try { response = await this.request(`${validated.apiOrigin}${path}`, { method: "GET", headers: { Accept: "application/json", Authorization: `Zoho-oauthtoken ${validated.accessToken}`, "User-Agent": "RelayConsole-ZohoProjects/1.0" }, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new ZohoProjectsApiError("provider_unavailable", "Zoho Projects is temporarily unavailable.", 502); }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000) throw new ZohoProjectsApiError("provider_validation_error", "Zoho Projects response exceeded the safe size limit.");
    if (!response.ok) throw new ZohoProjectsApiError(response.status === 401 ? "credential_missing" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", "Zoho Projects API request failed.", response.status);
    try { return this.object(raw ? JSON.parse(raw) : {}); } catch { throw new ZohoProjectsApiError("provider_validation_error", "Zoho Projects returned an invalid response."); }
  }
  private credentials(credentials: ZohoProjectsCredentials) {
    const accessToken = credentials.accessToken.trim();
    if (!accessToken || accessToken.length > 16_384) throw new ZohoProjectsApiError("credential_missing", "Zoho Projects OAuth credentials are missing or invalid.");
    if (!ID.test(credentials.portalId)) throw new ZohoProjectsApiError("provider_validation_error", "A valid bound Zoho Projects portal is required.");
    let apiOrigin = "";
    try { const url = new URL(credentials.apiOrigin); apiOrigin = url.origin; if (url.origin !== credentials.apiOrigin || !API_ORIGINS.has(apiOrigin)) throw new Error(); }
    catch { throw new ZohoProjectsApiError("provider_validation_error", "Zoho Projects regional API origin is invalid."); }
    return { accessToken, portalId: credentials.portalId, apiOrigin };
  }
  private project(row: JsonObject) { return { projectId: this.id(row.id), name: this.text(row.name), status: this.named(row.status), startDate: this.text(row.start_date ?? row.startDate), endDate: this.text(row.end_date ?? row.endDate), createdTime: this.text(row.created_time ?? row.createdTime), modifiedTime: this.text(row.modified_time ?? row.modifiedTime), percentComplete: this.number(row.percent_complete ?? row.percentComplete) }; }
  private task(row: JsonObject) { return { taskId: this.id(row.id), name: this.text(row.name), status: this.named(row.status), priority: this.text(row.priority), startDate: this.text(row.start_date ?? row.startDate), dueDate: this.text(row.end_date ?? row.due_date ?? row.dueDate), createdTime: this.text(row.created_time ?? row.createdTime), modifiedTime: this.text(row.modified_time ?? row.modifiedTime), percentComplete: this.number(row.percent_complete ?? row.percentComplete) }; }
  private rows(body: JsonObject, key: string) { const value = body[key] ?? body.data; return Array.isArray(value) ? value.map((row) => this.object(row)) : []; }
  private unwrap(body: JsonObject, key: string) { const value = body[key] ?? body.data ?? body; return Array.isArray(value) ? this.object(value[0]) : this.object(value); }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private id(value: unknown) { const candidate = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : typeof value === "string" ? value : ""; return ID.test(candidate) ? candidate : null; }
  private requiredId(value: unknown, label: string) { const id = typeof value === "string" ? value : ""; if (!ID.test(id)) throw new ZohoProjectsApiError("provider_validation_error", `A positive numeric Zoho Projects ${label} ID is required.`); return id; }
  private text(value: unknown) { return typeof value === "string" ? value.slice(0, 512) : null; }
  private number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null; }
  private named(value: unknown) { return typeof value === "string" ? value.slice(0, 128) : this.text(this.object(value).name); }
  private limit(value: unknown) { if (value === undefined) return 25; if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 25) throw new ZohoProjectsApiError("provider_validation_error", "Zoho Projects limit must be between 1 and 25."); return Number(value); }
}
