import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type RevCredentials = { clientApiKey: string; userApiKey: string };

export class RevApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class RevApiAdapter {
  health(credentials: RevCredentials) { return this.listOrders(credentials, { page: 0, page_size: 1 }); }
  listOrders(credentials: RevCredentials, input: JsonObject = {}) { return this.request(credentials, { method: "GET", path: "/orders", query: this.listQuery(input) }); }
  getOrder(credentials: RevCredentials, input: JsonObject) { return this.request(credentials, { method: "GET", path: `/orders/${this.identifier(input.orderNumber, "orderNumber")}` }); }
  getAttachment(credentials: RevCredentials, input: JsonObject) { return this.request(credentials, { method: "GET", path: `/attachments/${this.identifier(input.attachmentId, "attachmentId")}` }); }
  getAttachmentContent(credentials: RevCredentials, input: JsonObject) { return this.request(credentials, { method: "GET", path: `/attachments/${this.identifier(input.attachmentId, "attachmentId")}/content` }); }
  listWorkspaces(credentials: RevCredentials) { return this.request(credentials, { method: "GET", path: "/workspaces" }); }
  listTemplates(credentials: RevCredentials) { return this.request(credentials, { method: "GET", path: "/templates" }); }
  createInput(credentials: RevCredentials, input: JsonObject) { return this.request(credentials, { method: "POST", path: "/inputs", json: this.body(input) }); }
  placeOrder(credentials: RevCredentials, input: JsonObject) { return this.request(credentials, { method: "POST", path: "/orders", json: this.body(input) }); }
  cancelOrder(credentials: RevCredentials, input: JsonObject) { return this.request(credentials, { method: "POST", path: "/orders/cancel", json: this.body(input) }); }
  deleteOrderData(credentials: RevCredentials, input: JsonObject) { return this.request(credentials, { method: "DELETE", path: `/orders/${this.identifier(input.orderNumber, "orderNumber")}` }); }
  createShareLink(credentials: RevCredentials, input: JsonObject) { const { attachmentId, ...body } = input; return this.request(credentials, { method: "POST", path: `/attachments/${this.identifier(attachmentId, "attachmentId")}/share`, json: this.body(body) }); }

  async request(credentials: RevCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    this.requireCredentials(credentials); const method = input.method.toUpperCase();
    if (!this.allowed(method, input.path)) throw new RevApiError("provider_validation_error", "Rev method or path is outside the documented public v1 API boundary.");
    this.rejectSensitiveFields(input.query); this.rejectSensitiveFields(input.json);
    const url = new URL(`https://api.rev.com/api/v1${input.path}`); this.appendQuery(url.searchParams, input.query ?? {});
    const json = input.json === undefined ? undefined : this.body(input.json); const body = json === undefined ? undefined : JSON.stringify(json);
    if (body && Buffer.byteLength(body) > 2_000_000) throw new RevApiError("provider_validation_error", "Rev request exceeds 2 MB.");
    try {
      const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json, text/plain, text/vtt, application/x-subrip, application/octet-stream", Authorization: `Rev ${credentials.clientApiKey}:${credentials.userApiKey}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
      const raw = Buffer.from(await response.arrayBuffer()); if (raw.length > 10_000_000) throw new RevApiError("provider_validation_error", "Rev response exceeds 10 MB.");
      const type = response.headers.get("content-type") ?? ""; let data: unknown;
      if (type.includes("json")) { try { data = raw.length ? JSON.parse(raw.toString("utf8")) : null; } catch { data = raw.toString("utf8"); } }
      else if (type.includes("text") || type.includes("subrip")) data = { contentType: type, content: raw.toString("utf8") };
      else data = { contentType: type || "application/octet-stream", contentBase64: raw.toString("base64") };
      const location = response.headers.get("location"); if (location && data && typeof data === "object" && !Array.isArray(data)) data = { ...(data as JsonObject), location };
      data = this.redact(data);
      if (!response.ok) throw new RevApiError(this.safeCode(response.status), this.message(data) ?? `Rev returned HTTP ${response.status}.`, response.status); return data;
    } catch (error) { if (error instanceof RevApiError) throw error; throw new RevApiError("provider_unavailable", "Rev could not be reached.", 502); }
  }

  private allowed(method: string, path: string) {
    if (!path.startsWith("/") || path.includes("..") || path.length > 1000 || !/^[A-Za-z0-9_./-]+$/.test(path)) return false;
    if (method === "GET") return path === "/orders" || /^\/orders\/[A-Za-z0-9_-]{1,200}$/.test(path) || /^\/attachments\/[A-Za-z0-9_-]{1,200}(?:\/content)?$/.test(path) || path === "/workspaces" || path === "/templates";
    if (method === "POST") return path === "/inputs" || path === "/orders" || path === "/orders/cancel" || /^\/attachments\/[A-Za-z0-9_-]{1,200}\/share$/.test(path);
    return method === "DELETE" && /^\/orders\/[A-Za-z0-9_-]{1,200}$/.test(path);
  }
  private requireCredentials(c: RevCredentials) { if (!c.clientApiKey?.trim() || !c.userApiKey?.trim() || c.clientApiKey.length > 4000 || c.userApiKey.length > 4000) throw new RevApiError("credential_missing", "Rev client and user API keys are required.", 401); }
  private body(input: JsonObject) { const { approvalId: _approvalId, attachmentId: _attachmentId, orderNumber: _orderNumber, ...json } = input; return json; }
  private listQuery(input: JsonObject) { return this.pick(input, ["status", "service", "created_on", "created_before", "created_after"], { page: this.integer(input.page, 0, 0, 100000), page_size: this.integer(input.page_size, 20, 1, 100) }); }
  private pick(input: JsonObject, keys: string[], base: JsonObject) { const out = { ...base }; for (const key of keys) if (input[key] !== undefined && input[key] !== null && input[key] !== "") out[key] = input[key]; return out; }
  private rejectSensitiveFields(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new RevApiError("policy_blocked", "Rev request is too deeply nested.", 403); if (Array.isArray(item)) return item.forEach((entry) => walk(entry, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, entry] of Object.entries(item as JsonObject)) { if (/(notification|callback|webhook)(?:_?url)?/i.test(key)) throw new RevApiError("policy_blocked", "Caller-supplied notification, callback, and webhook destinations are not allowed.", 403); if (/(api.?key|access.?token|secret|authorization|password|cookie|credential)/i.test(key)) throw new RevApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); walk(entry, depth + 1); } }; if (value) walk(value); }
  private appendQuery(params: URLSearchParams, value: JsonObject) { if (Object.keys(value).length > 30) throw new RevApiError("provider_validation_error", "Rev query has too many fields."); for (const [key, item] of Object.entries(value)) { if (item === undefined || item === null || item === "") continue; if (!/^[A-Za-z0-9_]{1,100}$/.test(key)) throw new RevApiError("provider_validation_error", "Rev query key is invalid."); params.append(key, String(item).slice(0, 10_000)); } }
  private redact(value: unknown, depth = 0): unknown { if (depth > 10) return "[truncated]"; if (typeof value === "string") return value.slice(0, 10_000_000); if (Array.isArray(value)) return value.slice(0, 1000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 2000).map(([key, item]) => [key, /(api.?key|access.?token|secret|authorization|password|cookie|credential)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private message(value: unknown) { const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const candidate = body?.message ?? body?.error ?? body?.reason; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 402 || status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private identifier(value: unknown, name: string) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) throw new RevApiError("provider_validation_error", `${name} is invalid.`); return value; }
  private integer(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback; }
}
