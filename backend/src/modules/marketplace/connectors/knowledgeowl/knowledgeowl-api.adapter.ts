import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { request as httpsRequest } from "node:https";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type KnowledgeOwlCredentials = { projectId: string; apiKey: string };

const COLLECTIONS = new Map<string, Set<string>>([
  ["agent", new Set(["GET", "POST"])], ["article", new Set(["GET", "POST"])], ["managefilter", new Set(["GET", "POST"])],
  ["articlerevision", new Set(["GET"])], ["articleversion", new Set(["GET", "POST"])], ["category", new Set(["GET", "POST"])],
  ["comment", new Set(["GET", "POST"])], ["file", new Set(["GET", "POST"])], ["glossaryterm", new Set(["GET", "POST"])],
  ["reader", new Set(["GET", "POST"])], ["readerroles", new Set(["GET", "POST"])], ["readerfilter", new Set(["GET", "POST"])],
  ["remotelogin", new Set(["GET"])], ["remote-auth", new Set(["GET"])], ["remotelogout", new Set(["GET"])],
  ["snippet", new Set(["GET", "POST"])], ["suggest", new Set(["GET"])], ["synonym", new Set(["GET", "POST"])],
  ["tag", new Set(["GET", "POST"])], ["userrole", new Set(["GET", "POST"])], ["userteam", new Set(["GET", "POST"])],
  ["webhook", new Set(["GET", "POST"])],
]);
const ITEMS = new Map<string, Set<string>>([...COLLECTIONS.keys()].map((name) => [name, new Set(["GET", "PUT", "DELETE"])]));
ITEMS.set("articlerevision", new Set(["GET"]));
ITEMS.set("file", new Set(["GET", "PUT", "POST", "DELETE"]));
for (const name of ["remotelogin", "remote-auth", "remotelogout", "suggest"]) ITEMS.delete(name);

export class KnowledgeOwlApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class KnowledgeOwlApiAdapter {
  listArticles(credentials: KnowledgeOwlCredentials, input: JsonObject = {}) {
    return this.request(credentials, { method: "GET", path: "/article.json", query: { project_id: credentials.projectId, page: this.integer(input.page, 1, 1, 10_000), limit: this.integer(input.limit, 50, 1, 100), status: this.optionalString(input.status, 100) } });
  }
  getArticle(credentials: KnowledgeOwlCredentials, input: JsonObject) {
    return this.request(credentials, { method: "GET", path: `/article/${this.segment(input.articleId, "articleId")}.json`, query: { project_id: credentials.projectId } });
  }
  listCategories(credentials: KnowledgeOwlCredentials, input: JsonObject = {}) {
    return this.request(credentials, { method: "GET", path: "/category.json", query: { project_id: credentials.projectId, page: this.integer(input.page, 1, 1, 10_000), limit: this.integer(input.limit, 50, 1, 100) } });
  }
  async uploadFile(credentials: KnowledgeOwlCredentials, input: JsonObject) {
    this.requireCredentials(credentials);
    const filename = this.requiredString(input.filename, "filename", 200);
    if (/[\\/\0]/.test(filename)) throw new KnowledgeOwlApiError("provider_validation_error", "KnowledgeOwl filename is invalid.");
    const base64 = this.requiredString(input.fileBase64, "fileBase64", 7_000_000);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new KnowledgeOwlApiError("provider_validation_error", "fileBase64 is invalid.");
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > 5_000_000) throw new KnowledgeOwlApiError("provider_validation_error", "KnowledgeOwl uploads must be between 1 byte and 5 MB.");
    const form = new FormData();
    form.append("project_id", credentials.projectId); form.append("status", input.status === "inactive" ? "inactive" : "active"); form.append("name", filename);
    form.append("file", new Blob([new Uint8Array(bytes)]), filename);
    return this.fetch(credentials, new URL("https://app.knowledgeowl.com/api/head/file.json"), "POST", form);
  }
  async request(credentials: KnowledgeOwlCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    this.requireCredentials(credentials);
    const method = input.method.toUpperCase();
    if (!this.allowed(method, input.path)) throw new KnowledgeOwlApiError("provider_validation_error", "KnowledgeOwl method and path are not in the current External API allowlist.");
    this.rejectCredentialFields(input.query); this.rejectCredentialFields(input.json);
    const query = { ...(input.query ?? {}) }; const json = input.json ? { ...input.json } : undefined;
    this.bindProject(query, credentials.projectId); if (json) this.bindProject(json, credentials.projectId);
    const body = json ? JSON.stringify(json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) throw new KnowledgeOwlApiError("provider_validation_error", "KnowledgeOwl request exceeds 1 MB.");
    const url = new URL(`https://app.knowledgeowl.com/api/head${input.path}`); this.appendQuery(url.searchParams, query);
    if (method === "GET" && body) return this.httpsWithBody(credentials, url, body);
    return this.fetch(credentials, url, method, body);
  }
  private allowed(method: string, path: string) {
    const collection = path.match(/^\/([a-z-]+)\.json$/); if (collection) return COLLECTIONS.get(collection[1])?.has(method) ?? false;
    const item = path.match(/^\/([a-z-]+)\/([A-Za-z0-9_.:@+-]{1,200})\.json$/); return item ? ITEMS.get(item[1])?.has(method) ?? false : false;
  }
  private async fetch(credentials: KnowledgeOwlCredentials, url: URL, method: string, body?: string | FormData) {
    try {
      const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json", Authorization: this.authorization(credentials), ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(20_000) });
      const raw = Buffer.from(await response.arrayBuffer()); return this.parse(response.status, raw);
    } catch (error) { if (error instanceof KnowledgeOwlApiError) throw error; throw new KnowledgeOwlApiError("provider_unavailable", "KnowledgeOwl could not be reached.", 502); }
  }
  private httpsWithBody(credentials: KnowledgeOwlCredentials, url: URL, body: string) {
    return new Promise<unknown>((resolve, reject) => { const request = httpsRequest(url, { method: "GET", headers: { Accept: "application/json", Authorization: this.authorization(credentials), "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, timeout: 20_000 }, (response) => { const chunks: Buffer[] = []; let size = 0; response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 5_000_000) { request.destroy(); reject(new KnowledgeOwlApiError("provider_validation_error", "KnowledgeOwl response exceeds 5 MB.")); } else chunks.push(chunk); }); response.on("end", () => { try { resolve(this.parse(response.statusCode ?? 502, Buffer.concat(chunks))); } catch (error) { reject(error); } }); }); request.on("timeout", () => request.destroy(new Error("timeout"))); request.on("error", (error) => reject(error instanceof KnowledgeOwlApiError ? error : new KnowledgeOwlApiError("provider_unavailable", "KnowledgeOwl could not be reached.", 502))); request.write(body); request.end(); });
  }
  private parse(status: number, raw: Buffer) { if (raw.length > 5_000_000) throw new KnowledgeOwlApiError("provider_validation_error", "KnowledgeOwl response exceeds 5 MB."); const text = raw.toString("utf8"); let data: unknown = text; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 5_000_000); } data = this.redact(data); if (status < 200 || status >= 300) throw new KnowledgeOwlApiError(this.safeCode(status), this.errorMessage(data) ?? `KnowledgeOwl returned HTTP ${status}.`, status); return data; }
  private authorization(c: KnowledgeOwlCredentials) { return `Basic ${Buffer.from(`${c.apiKey}:x`, "utf8").toString("base64")}`; }
  private requireCredentials(c: KnowledgeOwlCredentials) { this.segment(c.projectId, "projectId"); if (!c.apiKey || c.apiKey.length > 2000) throw new KnowledgeOwlApiError("credential_missing", "KnowledgeOwl project ID and API key are required.", 401); }
  private bindProject(value: JsonObject, projectId: string) { const supplied = value.project_id; if (supplied !== undefined && String(supplied) !== projectId) throw new KnowledgeOwlApiError("policy_blocked", "KnowledgeOwl requests cannot escape the configured knowledge base.", 403); value.project_id = projectId; }
  private rejectCredentialFields(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new KnowledgeOwlApiError("policy_blocked", "KnowledgeOwl request is too deeply nested.", 403); if (Array.isArray(item)) return item.forEach((entry) => walk(entry, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, entry] of Object.entries(item as JsonObject)) { if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new KnowledgeOwlApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); walk(entry, depth + 1); } }; if (value) walk(value); }
  private appendQuery(params: URLSearchParams, value: JsonObject) { if (Object.keys(value).length > 50) throw new KnowledgeOwlApiError("provider_validation_error", "KnowledgeOwl query has too many fields."); for (const [key, item] of Object.entries(value)) { if (item === undefined || item === null || item === "") continue; if (Array.isArray(item)) item.slice(0, 100).forEach((entry) => params.append(key, String(entry).slice(0, 10_000))); else params.append(key, String(item).slice(0, 10_000)); } }
  private redact(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 1_000_000); if (Array.isArray(value)) return value.slice(0, 1000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 1000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private errorMessage(value: unknown) { const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const candidate = body?.message ?? body?.error ?? body?.reason; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private segment(value: unknown, name: string) { if (typeof value !== "string" || !value.trim() || value.length > 200 || !/^[A-Za-z0-9_.:@+-]+$/.test(value.trim())) throw new KnowledgeOwlApiError("provider_validation_error", `${name} is invalid.`); return value.trim(); }
  private requiredString(value: unknown, name: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new KnowledgeOwlApiError("provider_validation_error", `${name} is required and must be at most ${max} characters.`); return value.trim(); }
  private optionalString(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private integer(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback; }
}
