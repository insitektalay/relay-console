import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export class FrameIoApiError extends Error { constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); } }

@Injectable()
export class FrameIoApiAdapter {
  getMe(token: string) { return this.request(token, { method: "GET", path: "/v4/me" }); }
  listAccounts(token: string, input: JsonObject = {}) { return this.request(token, { method: "GET", path: "/v4/accounts", query: this.page(input) }); }
  listWorkspaces(token: string, input: JsonObject) { return this.request(token, { method: "GET", path: `/v4/accounts/${this.id(input.accountId, "accountId")}/workspaces`, query: this.page(input) }); }
  listProjects(token: string, input: JsonObject) { return this.request(token, { method: "GET", path: `/v4/accounts/${this.id(input.accountId, "accountId")}/workspaces/${this.id(input.workspaceId, "workspaceId")}/projects`, query: this.page(input) }); }
  listFolderChildren(token: string, input: JsonObject) { return this.request(token, { method: "GET", path: `/v4/accounts/${this.id(input.accountId, "accountId")}/folders/${this.id(input.folderId, "folderId")}/children`, query: this.page(input) }); }
  getFile(token: string, input: JsonObject) { return this.request(token, { method: "GET", path: `/v4/accounts/${this.id(input.accountId, "accountId")}/files/${this.id(input.fileId, "fileId")}` }); }
  listComments(token: string, input: JsonObject) { return this.request(token, { method: "GET", path: `/v4/accounts/${this.id(input.accountId, "accountId")}/files/${this.id(input.fileId, "fileId")}/comments`, query: this.page(input) }); }
  search(token: string, input: JsonObject) { return this.request(token, { method: "POST", path: `/v4/accounts/${this.id(input.accountId, "accountId")}/search`, query: this.page(input), json: { query: this.requiredString(input.query, "query", 1000), engine: input.engine === "nlp" ? "nlp" : "lexical" } }); }

  async request(token: string, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    if (!token?.trim() || token.length > 20_000) throw new FrameIoApiError("credential_missing", "Frame.io access token is required.", 401);
    const method = input.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) || !this.allowedPath(input.path)) throw new FrameIoApiError("provider_validation_error", "Frame.io method or path is outside the stable V4 API boundary.");
    this.rejectCredentials(input.query); this.rejectCredentials(input.json);
    const url = new URL(`https://api.frame.io${input.path}`); this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body) > 2_000_000) throw new FrameIoApiError("provider_validation_error", "Frame.io request exceeds 2 MB.");
    try {
      const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
      const raw = Buffer.from(await response.arrayBuffer()); if (raw.length > 10_000_000) throw new FrameIoApiError("provider_validation_error", "Frame.io response exceeds 10 MB.");
      const text = raw.toString("utf8"); let data: unknown = text; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 10_000_000); } data = this.redact(data);
      if (!response.ok) throw new FrameIoApiError(this.safeCode(response.status), this.message(data) ?? `Frame.io returned HTTP ${response.status}.`, response.status); return data;
    } catch (error) { if (error instanceof FrameIoApiError) throw error; throw new FrameIoApiError("provider_unavailable", "Frame.io could not be reached.", 502); }
  }

  private page(input: JsonObject) { return { page_size: this.integer(input.pageSize, 50, 1, 100), after: this.optionalString(input.after, 2000) }; }
  private allowedPath(path: string) { return /^\/v4(?:\/[A-Za-z0-9_.:@%+=~-]{1,300}){1,14}$/.test(path) && !path.includes("..") && !path.includes("//") && path.length <= 3000; }
  private appendQuery(params: URLSearchParams, value: JsonObject) { if (Object.keys(value).length > 100) throw new FrameIoApiError("provider_validation_error", "Frame.io request has too many fields."); for (const [key, item] of Object.entries(value)) { if (item === undefined || item === null || item === "") continue; if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) throw new FrameIoApiError("provider_validation_error", "Frame.io request key is invalid."); const entries = Array.isArray(item) ? item.slice(0, 100) : [item]; for (const entry of entries) { if (!["string", "number", "boolean"].includes(typeof entry)) throw new FrameIoApiError("provider_validation_error", `Frame.io request field ${key} must be scalar.`); params.append(key, String(entry).slice(0, 20_000)); } } }
  private rejectCredentials(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new FrameIoApiError("policy_blocked", "Frame.io request is too deeply nested.", 403); if (Array.isArray(item)) return item.slice(0, 1000).forEach((entry) => walk(entry, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, entry] of Object.entries(item as JsonObject)) { if (/(access.?token|refresh.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new FrameIoApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); walk(entry, depth + 1); } }; if (value) walk(value); }
  private redact(value: unknown, depth = 0): unknown { if (depth > 10) return "[truncated]"; if (typeof value === "string") return value.slice(0, 2_000_000); if (Array.isArray(value)) return value.slice(0, 2000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 2000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key|passphrase|upload_urls|download_url|inline_url|media_links)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private message(value: unknown) { const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const errors = Array.isArray(body?.errors) ? body?.errors : []; const detail = errors[0] && typeof errors[0] === "object" ? (errors[0] as JsonObject).detail : null; const candidate = detail ?? body?.error_description ?? body?.error ?? body?.message; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private id(value: unknown, name: string) { if (typeof value !== "string" || !/^[A-Za-z0-9_.:@-]{1,200}$/.test(value)) throw new FrameIoApiError("provider_validation_error", `${name} is invalid.`); return value; }
  private integer(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback; }
  private optionalString(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private requiredString(value: unknown, name: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new FrameIoApiError("provider_validation_error", `${name} is invalid.`); return value.trim(); }
}
