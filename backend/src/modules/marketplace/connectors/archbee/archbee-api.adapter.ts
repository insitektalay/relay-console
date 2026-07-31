import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { request as httpsRequest } from "node:https";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ArchbeeCredentials = { docSpaceId: string; apiKey: string };
const PUBLIC_API_METHODS = new Map<string, Set<string>>([
  ["/api/public-api/doc", new Set(["GET", "POST", "DELETE"])], ["/api/public-api/docs/search", new Set(["POST"])],
  ["/api/public-api/import-content", new Set(["POST"])], ["/api/public-api/info-api-reference", new Set(["GET"])],
  ["/api/public-api/space-group/create", new Set(["POST"])], ["/api/public-api/space-group/delete", new Set(["DELETE"])],
  ["/api/public-api/space/clone", new Set(["POST"])], ["/api/public-api/space/create", new Set(["POST"])],
  ["/api/public-api/space/delete", new Set(["DELETE"])], ["/api/public-api/space/publish", new Set(["POST"])],
  ["/api/public-api/space/update", new Set(["POST"])], ["/api/public-api/suggest-change/discard", new Set(["POST"])],
  ["/api/public-api/suggest-change/merge", new Set(["POST"])], ["/api/public-api/sync-api-reference", new Set(["POST"])],
  ["/api/public-api/team/display-rules", new Set(["GET"])], ["/api/public-api/team/export", new Set(["GET"])],
  ["/api/public-api/upload/file", new Set(["POST"])],
]);

export class ArchbeeApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class ArchbeeApiAdapter {
  getDocument(credentials: ArchbeeCredentials, input: JsonObject) {
    return this.request(credentials, { method: "GET", path: "/api/public-api/doc", json: { docId: this.segment(input.docId, "docId"), format: this.optionalEnum(input.format, ["markdown", "html", "json", "source"]) ?? "markdown" } });
  }

  searchDocuments(credentials: ArchbeeCredentials, input: JsonObject) {
    return this.request(credentials, { method: "POST", path: "/api/public-api/docs/search", json: { query: this.requiredString(input.query, "query", 2000), type: "words", persistSearch: false, searchOnlyTitle: input.searchOnlyTitle === true, dataTextFormat: this.optionalEnum(input.dataTextFormat, ["markdown", "html"]), parentDocId: this.optionalString(input.parentDocId, 200) } });
  }

  async uploadFile(credentials: ArchbeeCredentials, input: JsonObject) {
    this.requireCredentials(credentials);
    const filename = this.requiredString(input.filename, "filename", 200);
    if (!/\.(json|ya?ml|zip)$/i.test(filename)) throw new ArchbeeApiError("provider_validation_error", "Archbee uploads support JSON, YAML, or ZIP files.");
    const base64 = this.requiredString(input.fileBase64, "fileBase64", 7_000_000);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new ArchbeeApiError("provider_validation_error", "fileBase64 is invalid.");
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > 5_000_000) throw new ArchbeeApiError("provider_validation_error", "Archbee uploads must be between 1 byte and 5 MB.");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)]), filename);
    form.append("isPublic", String(input.isPublic !== false));
    return this.fetch(credentials, new URL("https://api.archbee.com/api/public-api/upload/file"), "POST", form);
  }

  async request(credentials: ArchbeeCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    this.requireCredentials(credentials);
    const method = input.method.toUpperCase();
    if (!PUBLIC_API_METHODS.get(input.path)?.has(method)) throw new ArchbeeApiError("provider_validation_error", "Archbee method and path are not in the documented Public API allowlist.");
    this.rejectCredentialFields(input.query); this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) throw new ArchbeeApiError("provider_validation_error", "Archbee request exceeds 1 MB.");
    const url = new URL(`https://api.archbee.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    if (method === "GET" && body) return this.httpsWithBody(credentials, url, method, body);
    return this.fetch(credentials, url, method, body);
  }

  private async fetch(credentials: ArchbeeCredentials, url: URL, method: string, body?: string | FormData) {
    try {
      const response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json", Authorization: `Bearer ${this.bearer(credentials)}`, ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(20_000) });
      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > 5_000_000) throw new ArchbeeApiError("provider_validation_error", "Archbee response exceeds 5 MB.");
      return this.parse(response.status, Buffer.from(await response.arrayBuffer()), response.headers.get("content-type"));
    } catch (error) { if (error instanceof ArchbeeApiError) throw error; throw new ArchbeeApiError("provider_unavailable", "Archbee could not be reached.", 502); }
  }

  private httpsWithBody(credentials: ArchbeeCredentials, url: URL, method: string, body: string) {
    return new Promise<unknown>((resolve, reject) => {
      const request = httpsRequest(url, { method, headers: { Accept: "application/json", Authorization: `Bearer ${this.bearer(credentials)}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, timeout: 20_000 }, (response) => {
        const chunks: Buffer[] = []; let size = 0;
        response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 5_000_000) { request.destroy(); reject(new ArchbeeApiError("provider_validation_error", "Archbee response exceeds 5 MB.")); } else chunks.push(chunk); });
        response.on("end", () => { try { resolve(this.parse(response.statusCode ?? 502, Buffer.concat(chunks), response.headers["content-type"])); } catch (error) { reject(error); } });
      });
      request.on("timeout", () => request.destroy(new Error("timeout")));
      request.on("error", (error) => reject(error instanceof ArchbeeApiError ? error : new ArchbeeApiError("provider_unavailable", "Archbee could not be reached.", 502)));
      request.write(body); request.end();
    });
  }

  private parse(status: number, raw: Buffer, contentType?: string | null) {
    if (raw.length > 5_000_000) throw new ArchbeeApiError("provider_validation_error", "Archbee response exceeds 5 MB.");
    let data: unknown;
    if (/application\/zip/i.test(contentType ?? "")) data = { contentType: "application/zip", encoding: "base64", data: raw.toString("base64"), byteLength: raw.length };
    else { const text = raw.toString("utf8"); data = text; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 5_000_000); } }
    data = this.redact(data);
    if (status < 200 || status >= 300) throw new ArchbeeApiError(this.safeCode(status), this.errorMessage(data) ?? `Archbee returned HTTP ${status}.`, status);
    return data;
  }
  private bearer(value: ArchbeeCredentials) { return Buffer.from(`${value.docSpaceId}~${value.apiKey}`, "utf8").toString("base64"); }
  private requireCredentials(value: ArchbeeCredentials) { if (!value.docSpaceId || !value.apiKey) throw new ArchbeeApiError("credential_missing", "Archbee DocSpace ID and API key are required.", 401); this.segment(value.docSpaceId, "docSpaceId"); }
  private rejectCredentialFields(value?: JsonObject) { const walk = (item: unknown, depth = 0) => { if (depth > 12) throw new ArchbeeApiError("policy_blocked", "Archbee request is too deeply nested.", 403); if (Array.isArray(item)) return item.forEach((entry) => walk(entry, depth + 1)); if (!item || typeof item !== "object") return; for (const [key, entry] of Object.entries(item as JsonObject)) { if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new ArchbeeApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); walk(entry, depth + 1); } }; if (value) walk(value); }
  private appendQuery(params: URLSearchParams, value?: JsonObject) { if (!value) return; if (Object.keys(value).length > 50) throw new ArchbeeApiError("provider_validation_error", "Archbee query has too many fields."); for (const [key, item] of Object.entries(value)) { if (item === undefined || item === null || item === "") continue; params.append(key, String(item).slice(0, 10_000)); } }
  private redact(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 1_000_000); if (Array.isArray(value)) return value.slice(0, 1000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 1000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private errorMessage(value: unknown) { const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; const candidate = body?.message ?? body?.error ?? body?.reason; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private segment(value: unknown, name: string) { if (typeof value !== "string" || !value.trim() || value.length > 200 || !/^[A-Za-z0-9_.:@+-]+$/.test(value.trim())) throw new ArchbeeApiError("provider_validation_error", `${name} is invalid.`); return value.trim(); }
  private requiredString(value: unknown, name: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new ArchbeeApiError("provider_validation_error", `${name} is required and must be at most ${max} characters.`); return value.trim(); }
  private optionalString(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private optionalEnum(value: unknown, values: string[]) { return typeof value === "string" && values.includes(value) ? value : undefined; }
}
