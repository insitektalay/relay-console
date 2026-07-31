import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type DescriptCredentials = { apiToken: string };

export class DescriptApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class DescriptApiAdapter {
  health(credentials: DescriptCredentials) { return this.listProjects(credentials, { limit: 1 }); }
  listProjects(credentials: DescriptCredentials, input: JsonObject = {}) { return this.request(credentials, { method: "GET", path: "/projects", query: this.projectQuery(input) }); }
  getProject(credentials: DescriptCredentials, input: JsonObject) { return this.request(credentials, { method: "GET", path: `/projects/${this.uuid(input.projectId, "projectId")}` }); }
  listJobs(credentials: DescriptCredentials, input: JsonObject = {}) { return this.request(credentials, { method: "GET", path: "/jobs", query: this.jobQuery(input) }); }
  getJob(credentials: DescriptCredentials, input: JsonObject) { return this.request(credentials, { method: "GET", path: `/jobs/${this.uuid(input.jobId, "jobId")}` }); }
  listAgentModels(credentials: DescriptCredentials) { return this.request(credentials, { method: "GET", path: "/agent/models" }); }
  importMedia(credentials: DescriptCredentials, input: JsonObject) { return this.request(credentials, { method: "POST", path: "/jobs/import/project_media", json: this.body(input) }); }
  agentEdit(credentials: DescriptCredentials, input: JsonObject) { return this.request(credentials, { method: "POST", path: "/jobs/agent", json: this.body(input) }); }
  publish(credentials: DescriptCredentials, input: JsonObject) { return this.request(credentials, { method: "POST", path: "/jobs/publish", json: this.body(input) }); }
  exportTranscript(credentials: DescriptCredentials, input: JsonObject) { return this.request(credentials, { method: "POST", path: "/export/transcript", json: this.body(input) }); }
  cancelJob(credentials: DescriptCredentials, input: JsonObject) { return this.request(credentials, { method: "DELETE", path: `/jobs/${this.uuid(input.jobId, "jobId")}` }); }

  async request(credentials: DescriptCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    this.requireCredentials(credentials); const method = input.method.toUpperCase();
    if (!this.allowed(method, input.path)) throw new DescriptApiError("provider_validation_error", "Descript method or path is outside the documented public v1 API boundary.");
    this.rejectCredentials(input.query); this.rejectCredentials(input.json);
    const url = new URL(`https://descriptapi.com/v1${input.path}`); this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json === undefined ? undefined : JSON.stringify(input.json); if (body && Buffer.byteLength(body) > 2_000_000) throw new DescriptApiError("provider_validation_error", "Descript request exceeds 2 MB.");
    try {
      const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json, text/plain, text/markdown, text/html, application/rtf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/x-subrip", Authorization: `Bearer ${credentials.apiToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
      const raw = Buffer.from(await response.arrayBuffer()); if (raw.length > 10_000_000) throw new DescriptApiError("provider_validation_error", "Descript response exceeds 10 MB.");
      const type = response.headers.get("content-type") ?? ""; let data: unknown;
      if (type.includes("json")) { try { data = raw.length ? JSON.parse(raw.toString("utf8")) : null; } catch { data = raw.toString("utf8").slice(0, 10_000_000); } }
      else if (type.includes("text") || type.includes("rtf") || type.includes("subrip")) data = { contentType: type, content: raw.toString("utf8").slice(0, 10_000_000), compositionId: response.headers.get("x-composition-id") };
      else data = { contentType: type || "application/octet-stream", contentBase64: raw.toString("base64"), compositionId: response.headers.get("x-composition-id") };
      data = this.redact(data);
      if (!response.ok) throw new DescriptApiError(this.safeCode(response.status), this.message(data) ?? `Descript returned HTTP ${response.status}.`, response.status); return data;
    } catch (error) { if (error instanceof DescriptApiError) throw error; throw new DescriptApiError("provider_unavailable", "Descript could not be reached.", 502); }
  }
  private allowed(method: string, path: string) { if (!path.startsWith("/") || path.includes("..") || path.length > 1000 || !/^[A-Za-z0-9_./-]+$/.test(path)) return false; if (method === "GET") return path === "/projects" || /^\/projects\/[0-9a-f-]{36}$/i.test(path) || path === "/jobs" || /^\/jobs\/[0-9a-f-]{36}$/i.test(path) || path === "/agent/models"; if (method === "POST") return ["/jobs/import/project_media", "/jobs/agent", "/jobs/publish", "/export/transcript"].includes(path); return method === "DELETE" && /^\/jobs\/[0-9a-f-]{36}$/i.test(path); }
  private requireCredentials(c: DescriptCredentials) { if (!c.apiToken?.trim() || c.apiToken.length > 4000) throw new DescriptApiError("credential_missing", "Descript API token is required.", 401); }
  private body(input: JsonObject) { const { approvalId: _approvalId, ...json } = input; if (Object.prototype.hasOwnProperty.call(json, "callback_url")) throw new DescriptApiError("policy_blocked", "Caller-supplied Descript callback URLs are not allowed.", 403); return json; }
  private projectQuery(input: JsonObject) { return this.pick(input, ["name", "folder_path", "created_by", "created_after", "created_before", "updated_after", "updated_before", "sort", "direction", "cursor"], { limit: this.integer(input.limit, 20, 1, 100) }); }
  private jobQuery(input: JsonObject) { return this.pick(input, ["project_id", "type", "cursor", "created_after", "created_before"], { limit: this.integer(input.limit, 20, 1, 100) }); }
  private pick(input: JsonObject, keys: string[], base: JsonObject) { const out = { ...base }; for (const key of keys) if (input[key] !== undefined && input[key] !== null && input[key] !== "") out[key] = input[key]; return out; }
  private rejectCredentials(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new DescriptApiError("policy_blocked", "Descript request is too deeply nested.", 403); if (Array.isArray(item)) return item.forEach((entry) => walk(entry, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, entry] of Object.entries(item as JsonObject)) { if (key === "callback_url") throw new DescriptApiError("policy_blocked", "Caller-supplied Descript callback URLs are not allowed.", 403); if (/(api.?token|access.?token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new DescriptApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); walk(entry, depth + 1); } }; if (value) walk(value); }
  private appendQuery(params: URLSearchParams, value: JsonObject) { if (Object.keys(value).length > 30) throw new DescriptApiError("provider_validation_error", "Descript query has too many fields."); for (const [key, item] of Object.entries(value)) { if (item === undefined || item === null || item === "") continue; if (!/^[A-Za-z0-9_]{1,100}$/.test(key)) throw new DescriptApiError("provider_validation_error", "Descript query key is invalid."); params.append(key, String(item).slice(0, 10_000)); } }
  private redact(value: unknown, depth = 0): unknown { if (depth > 10) return "[truncated]"; if (typeof value === "string") return value.slice(0, 10_000_000); if (Array.isArray(value)) return value.slice(0, 1000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 2000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key|upload_url|download_url)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private message(value: unknown) { const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const candidate = body?.message ?? body?.error ?? body?.reason; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 402 || status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private uuid(value: unknown, name: string) { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new DescriptApiError("provider_validation_error", `${name} must be a UUID.`); return value; }
  private integer(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback; }
}
