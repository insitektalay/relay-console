import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GoogleDriveApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

export class GoogleDriveApiAdapter {
  private readonly apiOrigin = "https://www.googleapis.com/drive/v3";
  private readonly uploadOrigin = "https://www.googleapis.com/upload/drive/v3";
  private readonly fields = "id,name,mimeType,description,size,md5Checksum,createdTime,modifiedTime,parents,webViewLink,iconLink,trashed,ownedByMe,capabilities(canCopy,canDownload)";

  async health(token: string) {
    await this.requestJson(token, "GET", `${this.apiOrigin}/files`, { pageSize: "1", fields: "files(id)" });
  }

  async searchFiles(token: string, input: JsonObject) {
    const maxResults = this.limit(input.maxResults, 10, 25);
    const query = this.optionalText(input.query, 200);
    const q = ["trashed = false", query ? `name contains '${this.escapeQuery(query)}'` : ""].filter(Boolean).join(" and ");
    const value = await this.requestJson(token, "GET", `${this.apiOrigin}/files`, { q, pageSize: String(maxResults), orderBy: "modifiedTime desc", spaces: "drive", fields: `nextPageToken,files(${this.fields})` });
    const files = this.array(value.files).slice(0, maxResults).map((item) => this.file(item));
    return { files, count: files.length, nextPageTokenPresent: Boolean(this.text(value.nextPageToken)), nextPageFollowed: false, providerRequestCount: 1 };
  }

  async getFile(token: string, input: JsonObject) {
    const fileId = this.id(input.fileId, "fileId");
    return { file: this.file(await this.requestJson(token, "GET", `${this.apiOrigin}/files/${fileId}`, { fields: this.fields })), providerRequestCount: 1 };
  }

  async readText(token: string, input: JsonObject) {
    const fileId = this.id(input.fileId, "fileId");
    const metadata = await this.requestJson(token, "GET", `${this.apiOrigin}/files/${fileId}`, { fields: this.fields });
    const mimeType = this.text(metadata.mimeType) ?? "";
    if (!(mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/vnd.google-apps.document")) {
      throw new GoogleDriveApiError("provider_validation_error", "Google Drive V1 reads only bounded UTF-8 text or Google Docs text exports.");
    }
    const url = mimeType === "application/vnd.google-apps.document" ? `${this.apiOrigin}/files/${fileId}/export` : `${this.apiOrigin}/files/${fileId}`;
    const text = await this.requestText(token, "GET", url, mimeType === "application/vnd.google-apps.document" ? { mimeType: "text/plain" } : { alt: "media" });
    return { file: this.file(metadata), text, byteCount: Buffer.byteLength(text), truncated: false, providerRequestCount: 2 };
  }

  prepareTextFile(input: JsonObject) {
    const change = { name: this.name(input.name), text: this.boundedText(input.text), parentFolderId: this.optionalId(input.parentFolderId) };
    return { change, digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"), providerRequestCount: 0 };
  }

  async createTextFile(token: string, input: JsonObject) {
    const name = this.name(input.name), text = this.boundedText(input.text), parentFolderId = this.optionalId(input.parentFolderId);
    const boundary = `RelayDrive${createHash("sha256").update(`${name}:${this.key(input.idempotencyKey)}`).digest("hex").slice(0, 24)}`;
    const metadata = { name, mimeType: "text/plain", ...(parentFolderId ? { parents: [parentFolderId] } : {}) };
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--\r\n`;
    const value = await this.requestJson(token, "POST", `${this.uploadOrigin}/files`, { uploadType: "multipart", fields: this.fields }, body, { "Content-Type": `multipart/related; boundary=${boundary}` });
    return { operation: "create_text_file", file: this.file(value), idempotencyKey: this.key(input.idempotencyKey), providerRequestCount: 1 };
  }

  async copyFile(token: string, input: JsonObject) {
    const fileId = this.id(input.fileId, "fileId"), parentFolderId = this.optionalId(input.parentFolderId), name = this.optionalText(input.name, 200);
    const value = await this.requestJson(token, "POST", `${this.apiOrigin}/files/${fileId}/copy`, { fields: this.fields }, { ...(parentFolderId ? { parents: [parentFolderId] } : {}), ...(name ? { name } : {}) });
    return { operation: "copy_file", file: this.file(value), idempotencyKey: this.key(input.idempotencyKey), providerRequestCount: 1 };
  }

  private async requestJson(token: string, method: string, baseUrl: string, query: Record<string, string>, body?: JsonObject | string, headers: Record<string, string> = {}) {
    const raw = await this.request(token, method, baseUrl, query, body, headers);
    try { return this.object(raw ? JSON.parse(raw) : {}); } catch { throw new GoogleDriveApiError("provider_validation_error", "Google Drive returned invalid JSON."); }
  }

  private async requestText(token: string, method: string, baseUrl: string, query: Record<string, string>) {
    return this.request(token, method, baseUrl, query);
  }

  private async request(token: string, method: string, baseUrl: string, query: Record<string, string>, body?: JsonObject | string, headers: Record<string, string> = {}) {
    if (!token || token.length > 8000) throw new GoogleDriveApiError("credential_missing", "A Google OAuth access token is required.", 401);
    const url = new URL(baseUrl); Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    let response: Response;
    try {
      response = await safeConnectorFetch(url, { method, headers: { Accept: "application/json,text/plain", Authorization: `Bearer ${token}`, ...(body && typeof body !== "string" ? { "Content-Type": "application/json" } : {}), ...headers }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }), redirect: "error", signal: AbortSignal.timeout(20000) });
    } catch { throw new GoogleDriveApiError("provider_unavailable", "Google Drive could not be reached.", 502); }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 262144) throw new GoogleDriveApiError("provider_validation_error", "Google Drive response exceeded Relay bounds.");
    if (!response.ok) throw new GoogleDriveApiError(response.status === 401 ? "token_expired" : response.status === 403 ? "insufficient_scope" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_validation_error", response.status === 429 ? "Google Drive rate limit reached; retry later." : "Google Drive rejected the bounded request.", response.status);
    return raw;
  }

  private file(value: unknown) { const item = this.object(value), capabilities = this.object(item.capabilities); return { id: this.text(item.id), name: this.text(item.name), mimeType: this.text(item.mimeType), description: this.text(item.description), size: this.number(item.size), md5Checksum: this.text(item.md5Checksum), createdTime: this.text(item.createdTime), modifiedTime: this.text(item.modifiedTime), parents: this.array(item.parents).slice(0, 10).map((parent) => this.text(parent)).filter(Boolean), webViewLink: this.text(item.webViewLink), iconLink: this.text(item.iconLink), trashed: item.trashed === true, ownedByMe: item.ownedByMe === true, canCopy: capabilities.canCopy === true, canDownload: capabilities.canDownload === true }; }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
  private text(value: unknown) { return typeof value === "string" && value.length <= 10000 ? value : null; }
  private number(value: unknown) { const result = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN; return Number.isFinite(result) ? result : null; }
  private id(value: unknown, field: string) { const result = this.text(value); if (!result || !/^[A-Za-z0-9_-]{1,200}$/.test(result)) throw new GoogleDriveApiError("provider_validation_error", `${field} is invalid.`); return result; }
  private optionalId(value: unknown) { return value == null || value === "" ? null : this.id(value, "parentFolderId"); }
  private name(value: unknown) { const result = this.text(value)?.trim(); if (!result || result.length > 200 || /[\r\n]/.test(result)) throw new GoogleDriveApiError("provider_validation_error", "File name is invalid."); return result; }
  private optionalText(value: unknown, max: number) { if (value == null || value === "") return null; const result = this.text(value)?.trim(); if (!result || result.length > max) throw new GoogleDriveApiError("provider_validation_error", "Text input is invalid."); return result; }
  private boundedText(value: unknown) { if (typeof value !== "string" || Buffer.byteLength(value) > 262144) throw new GoogleDriveApiError("provider_validation_error", "Text must be at most 256 KiB."); return value; }
  private limit(value: unknown, fallback: number, max: number) { const result = value == null ? fallback : Number(value); if (!Number.isInteger(result) || result < 1 || result > max) throw new GoogleDriveApiError("provider_validation_error", `maxResults must be between 1 and ${max}.`); return result; }
  private key(value: unknown) { const result = this.text(value); if (!result || result.length < 8 || result.length > 200) throw new GoogleDriveApiError("provider_validation_error", "idempotencyKey is invalid."); return result; }
  private escapeQuery(value: string) { return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
}
