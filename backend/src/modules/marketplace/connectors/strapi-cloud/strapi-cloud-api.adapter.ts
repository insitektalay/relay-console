import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type StrapiCloudCredentials = { instanceUrl: string; allowedApiIds: string; apiToken: string };

export class StrapiCloudApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class StrapiCloudApiAdapter {
  listConfiguredContentTypes(credentials: StrapiCloudCredentials) {
    this.requireCredentials(credentials);
    return { pluralApiIds: this.allowedApiIds(credentials.allowedApiIds), providerSideEffect: false };
  }

  listDocuments(credentials: StrapiCloudCredentials, input: JsonObject = {}) {
    const apiId = this.allowedApiId(credentials, input.pluralApiId);
    const query = new URLSearchParams({
      "pagination[page]": String(this.integer(input.page, 1, 1, 10_000)),
      "pagination[pageSize]": String(this.integer(input.pageSize, 25, 1, 25)),
      status: this.enumValue(input.status, ["draft", "published"], "published"),
    });
    const locale = this.optionalLocale(input.locale);
    if (locale) query.set("locale", locale);
    return this.request(credentials, "GET", `/api/${encodeURIComponent(apiId)}?${query}`);
  }

  getDocument(credentials: StrapiCloudCredentials, input: JsonObject) {
    const apiId = this.allowedApiId(credentials, input.pluralApiId);
    const id = this.documentId(input.documentId);
    const query = new URLSearchParams({ status: this.enumValue(input.status, ["draft", "published"], "published") });
    const locale = this.optionalLocale(input.locale);
    if (locale) query.set("locale", locale);
    return this.request(credentials, "GET", `/api/${encodeURIComponent(apiId)}/${encodeURIComponent(id)}?${query}`);
  }

  prepareDocumentChange(credentials: StrapiCloudCredentials, input: JsonObject) {
    const operation = this.enumValue(input.operation, ["create_draft", "update_draft", "publish"], "");
    const pluralApiId = this.allowedApiId(credentials, input.pluralApiId);
    const documentId = operation === "create_draft" ? undefined : this.documentId(input.documentId);
    const expectedUpdatedAt = operation === "create_draft" ? undefined : this.timestamp(input.expectedUpdatedAt);
    const locale = this.optionalLocale(input.locale);
    const fields = operation === "publish" ? undefined : this.fields(input.fields);
    const prepared = { operation, pluralApiId, ...(documentId ? { documentId } : {}), ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}), ...(locale ? { locale } : {}), ...(fields ? { fields } : {}) };
    return { ...prepared, payloadHash: createHash("sha256").update(JSON.stringify(prepared)).digest("hex"), providerSideEffect: false };
  }

  createDraft(credentials: StrapiCloudCredentials, input: JsonObject) {
    const apiId = this.allowedApiId(credentials, input.pluralApiId);
    const query = this.writeQuery("draft", input.locale);
    return this.request(credentials, "POST", `/api/${encodeURIComponent(apiId)}?${query}`, { data: this.fields(input.fields) });
  }

  async updateDraft(credentials: StrapiCloudCredentials, input: JsonObject) {
    const apiId = this.allowedApiId(credentials, input.pluralApiId);
    const id = this.documentId(input.documentId);
    const expected = this.timestamp(input.expectedUpdatedAt);
    const locale = this.optionalLocale(input.locale);
    await this.assertCurrentDraft(credentials, apiId, id, expected, locale);
    const query = this.writeQuery("draft", locale);
    return this.request(credentials, "PUT", `/api/${encodeURIComponent(apiId)}/${encodeURIComponent(id)}?${query}`, { data: this.fields(input.fields) });
  }

  async publishDocument(credentials: StrapiCloudCredentials, input: JsonObject) {
    const apiId = this.allowedApiId(credentials, input.pluralApiId);
    const id = this.documentId(input.documentId);
    const expected = this.timestamp(input.expectedUpdatedAt);
    const locale = this.optionalLocale(input.locale);
    await this.assertCurrentDraft(credentials, apiId, id, expected, locale);
    const query = this.writeQuery("published", locale);
    return this.request(credentials, "PUT", `/api/${encodeURIComponent(apiId)}/${encodeURIComponent(id)}?${query}`, { data: {} });
  }

  private async assertCurrentDraft(credentials: StrapiCloudCredentials, apiId: string, documentId: string, expectedUpdatedAt: string, locale?: string) {
    const result = await this.getDocument(credentials, { pluralApiId: apiId, documentId, status: "draft", ...(locale ? { locale } : {}) });
    const document = this.object(this.object(result)?.data);
    if (!document) throw new StrapiCloudApiError("provider_validation_error", "Strapi Cloud did not return the requested draft.");
    if (document.publishedAt !== null && document.publishedAt !== undefined) throw new StrapiCloudApiError("policy_blocked", "Only the draft version can be changed by this action.", 403);
    if (document.updatedAt !== expectedUpdatedAt) throw new StrapiCloudApiError("approval_mismatch", "The Strapi draft changed after it was reviewed; reload it before retrying.", 409);
  }

  private writeQuery(status: "draft" | "published", locale: unknown) {
    const query = new URLSearchParams({ status });
    const normalized = this.optionalLocale(locale);
    if (normalized) query.set("locale", normalized);
    return query;
  }

  private async request(credentials: StrapiCloudCredentials, method: "GET" | "POST" | "PUT", path: string, json?: JsonObject) {
    const origin = this.instanceOrigin(credentials.instanceUrl);
    this.requireToken(credentials.apiToken);
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/api/")) throw new StrapiCloudApiError("policy_blocked", "The Strapi Cloud request left its configured Content API boundary.", 403);
    const body = json ? JSON.stringify(json) : undefined;
    if (body && Buffer.byteLength(body) > 300_000) throw new StrapiCloudApiError("provider_validation_error", "Strapi Cloud request exceeds 300 KB.");
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: { Accept: "application/json", Authorization: `Bearer ${credentials.apiToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 5_000_000) throw new StrapiCloudApiError("provider_validation_error", "Strapi Cloud response exceeds 5 MB.");
      let data: unknown = raw.toString("utf8");
      try { data = raw.length ? JSON.parse(raw.toString("utf8")) : null; } catch { /* keep bounded text */ }
      data = this.redact(data);
      if (!response.ok) throw new StrapiCloudApiError(this.safeCode(response.status), this.errorMessage(data) ?? `Strapi Cloud returned HTTP ${response.status}.`, response.status);
      return data;
    } catch (error) {
      if (error instanceof StrapiCloudApiError) throw error;
      throw new StrapiCloudApiError("provider_unavailable", "Strapi Cloud could not be reached.", 502);
    }
  }

  private requireCredentials(credentials: StrapiCloudCredentials) {
    this.instanceOrigin(credentials.instanceUrl);
    this.allowedApiIds(credentials.allowedApiIds);
    this.requireToken(credentials.apiToken);
  }

  private instanceOrigin(value: string) {
    let url: URL;
    try { url = new URL(value); } catch { throw new StrapiCloudApiError("provider_validation_error", "Enter a valid Strapi Cloud HTTPS address."); }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "") || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.strapiapp\.com$/.test(hostname)) {
      throw new StrapiCloudApiError("policy_blocked", "Strapi Cloud V1 requires the exact public HTTPS project address ending in strapiapp.com.", 403);
    }
    return `https://${hostname}`;
  }

  private allowedApiIds(value: string) {
    const ids = [...new Set(String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
    if (!ids.length || ids.length > 50) throw new StrapiCloudApiError("provider_validation_error", "Enter between 1 and 50 allowed Strapi plural API IDs.");
    for (const id of ids) this.validateApiId(id);
    return ids.sort();
  }

  private allowedApiId(credentials: StrapiCloudCredentials, value: unknown) {
    const id = this.validateApiId(value);
    if (!this.allowedApiIds(credentials.allowedApiIds).includes(id)) throw new StrapiCloudApiError("policy_blocked", `Content type ${id} is not allowed by this connection.`, 403);
    return id;
  }

  private validateApiId(value: unknown) {
    const id = String(value ?? "").trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,99}$/.test(id) || ["admin", "auth", "upload", "users", "api-tokens", "users-permissions"].includes(id)) throw new StrapiCloudApiError("provider_validation_error", "The Strapi plural API ID is invalid or reserved.");
    return id;
  }

  private requireToken(value: string) { if (!value || value.length > 8_000) throw new StrapiCloudApiError("credential_missing", "Strapi Cloud address, content-type allowlist, and Content API token are required.", 401); }
  private documentId(value: unknown) { const id = String(value ?? "").trim(); if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new StrapiCloudApiError("provider_validation_error", "documentId is invalid."); return id; }
  private timestamp(value: unknown) { const text = String(value ?? ""); const date = new Date(text); if (text.length > 40 || Number.isNaN(date.getTime()) || date.toISOString() !== text) throw new StrapiCloudApiError("provider_validation_error", "expectedUpdatedAt must be an exact ISO-8601 UTC timestamp."); return text; }
  private optionalLocale(value: unknown) { if (value === undefined || value === null || value === "") return undefined; const locale = String(value).trim(); if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale) || locale.length > 35) throw new StrapiCloudApiError("provider_validation_error", "locale is invalid."); return locale; }

  private fields(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new StrapiCloudApiError("provider_validation_error", "fields must be an object.");
    const fields = value as JsonObject;
    const keys = Object.keys(fields);
    if (!keys.length || keys.length > 100) throw new StrapiCloudApiError("provider_validation_error", "fields must contain between 1 and 100 properties.");
    for (const reserved of ["id", "documentId", "createdAt", "updatedAt", "publishedAt", "locale", "status"]) if (reserved in fields) throw new StrapiCloudApiError("policy_blocked", `Strapi field ${reserved} is managed by Relay or Strapi.`, 403);
    this.rejectSecretsAndDepth(fields);
    if (Buffer.byteLength(JSON.stringify(fields)) > 250_000) throw new StrapiCloudApiError("provider_validation_error", "Strapi fields exceed 250 KB.");
    return fields;
  }

  private rejectSecretsAndDepth(value: unknown, depth = 0) {
    if (depth > 20) throw new StrapiCloudApiError("policy_blocked", "Strapi fields are too deeply nested.", 403);
    if (Array.isArray(value)) { if (value.length > 1_000) throw new StrapiCloudApiError("provider_validation_error", "Strapi field arrays are too large."); return value.forEach((item) => this.rejectSecretsAndDepth(item, depth + 1)); }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new StrapiCloudApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403);
      this.rejectSecretsAndDepth(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 1_000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)]));
  }

  private errorMessage(value: unknown) { const object = this.object(value); const nested = this.object(object?.error); const candidate = nested?.message ?? object?.message ?? object?.error; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 404) return "provider_validation_error"; if (status === 409) return "approval_mismatch"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private enumValue(value: unknown, allowed: string[], fallback: string) { const selected = String(value ?? fallback); if (!allowed.includes(selected)) throw new StrapiCloudApiError("provider_validation_error", "status or operation is invalid."); return selected; }
  private integer(value: unknown, fallback: number, minimum: number, maximum: number) { const number = Number(value ?? fallback); if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new StrapiCloudApiError("provider_validation_error", `Value must be an integer from ${minimum} to ${maximum}.`); return number; }
  private object(value: unknown): JsonObject | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
}
