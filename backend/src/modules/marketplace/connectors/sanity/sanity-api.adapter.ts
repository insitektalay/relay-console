import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SanityCredentials = { projectId: string; dataset: string; apiToken: string };

export class SanityApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class SanityApiAdapter {
  private readonly apiVersion = "v2025-02-19";

  async listDocumentTypes(credentials: SanityCredentials, input: JsonObject = {}) {
    const limit = this.integer(input.limit, 50, 1, 100);
    const lastId = this.optionalPublishedId(input.lastId) ?? "";
    const result = await this.query(credentials,
      `*[_id > $lastId && !(_id in path("_.**")) && !(_id in path("versions.**"))] | order(_id)[0...$limit]{_id,_type}`,
      { lastId, limit },
    );
    const rows = Array.isArray(result) ? result : [];
    return {
      types: [...new Set(rows.map((row) => this.object(row)?._type).filter((value): value is string => typeof value === "string"))].sort(),
      nextCursor: this.lastDocumentId(rows),
      scanned: rows.length,
    };
  }

  listDocuments(credentials: SanityCredentials, input: JsonObject = {}) {
    const limit = this.integer(input.limit, 25, 1, 50);
    const lastId = this.optionalPublishedId(input.lastId) ?? "";
    const type = this.optionalIdentifier(input.type, "type", 128);
    const includeDrafts = input.includeDrafts === true;
    const versionFilter = includeDrafts
      ? `!(_id in path("_.**")) && !(_id in path("versions.**"))`
      : `!(_id in path("_.**")) && !(_id in path("drafts.**")) && !(_id in path("versions.**"))`;
    const typeFilter = type ? " && _type == $type" : "";
    return this.query(credentials,
      `*[_id > $lastId && ${versionFilter}${typeFilter}] | order(_id)[0...$limit]{_id,_type,_rev,_createdAt,_updatedAt,title,name,slug}`,
      { lastId, limit, ...(type ? { type } : {}) },
    );
  }

  getDocument(credentials: SanityCredentials, input: JsonObject) {
    const publishedId = this.publishedId(input.documentId, "documentId");
    return this.query(credentials,
      `*[_id == $publishedId || _id == $draftId] | order(_id){...}`,
      { publishedId, draftId: `drafts.${publishedId}` },
    );
  }

  prepareDocumentChange(input: JsonObject) {
    const operation = this.enumValue(input.operation, ["create_draft", "update_draft", "publish"], "operation");
    const documentId = this.publishedId(input.documentId, "documentId");
    const type = operation === "create_draft" ? this.identifier(input.type, "type", 128) : this.optionalIdentifier(input.type, "type", 128);
    const expectedRevisionId = operation === "create_draft" ? undefined : this.identifier(input.expectedRevisionId, "expectedRevisionId", 200);
    const fields = operation === "publish" ? undefined : this.fields(input.fields);
    const prepared = { operation, documentId, ...(type ? { type } : {}), ...(expectedRevisionId ? { expectedRevisionId } : {}), ...(fields ? { fields } : {}) };
    return { ...prepared, payloadHash: createHash("sha256").update(JSON.stringify(prepared)).digest("hex"), providerSideEffect: false };
  }

  createDraft(credentials: SanityCredentials, input: JsonObject) {
    const publishedId = this.publishedId(input.documentId, "documentId");
    const type = this.identifier(input.type, "type", 128);
    const fields = this.fields(input.fields);
    return this.write(credentials, "actions", {
      actions: [{ actionType: "sanity.action.document.create", publishedId, document: { ...fields, _id: `drafts.${publishedId}`, _type: type }, ifExists: "fail" }],
      transactionId: this.idempotencyKey(input.idempotencyKey),
    });
  }

  updateDraft(credentials: SanityCredentials, input: JsonObject) {
    const publishedId = this.publishedId(input.documentId, "documentId");
    const expectedRevisionId = this.identifier(input.expectedRevisionId, "expectedRevisionId", 200);
    return this.write(credentials, "mutate", {
      mutations: [{ patch: { id: `drafts.${publishedId}`, ifRevisionID: expectedRevisionId, set: this.fields(input.fields) } }],
      transactionId: this.idempotencyKey(input.idempotencyKey),
      returnIds: true,
      returnDocuments: false,
    });
  }

  publishDocument(credentials: SanityCredentials, input: JsonObject) {
    const publishedId = this.publishedId(input.documentId, "documentId");
    return this.write(credentials, "actions", {
      actions: [{ actionType: "sanity.action.document.publish", publishedId, draftId: `drafts.${publishedId}`, ifDraftRevisionId: this.identifier(input.expectedRevisionId, "expectedRevisionId", 200) }],
      transactionId: this.idempotencyKey(input.idempotencyKey),
    });
  }

  private async query(credentials: SanityCredentials, query: string, params: JsonObject) {
    this.requireCredentials(credentials);
    const url = this.url(credentials, "query");
    url.searchParams.set("query", query);
    url.searchParams.set("perspective", "raw");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(`$${key}`, JSON.stringify(value));
    if (url.toString().length > 8_000) throw new SanityApiError("provider_validation_error", "Sanity query is too large.");
    const body = await this.fetch(credentials, url, { method: "GET" });
    return this.object(body)?.result ?? body;
  }

  private write(credentials: SanityCredentials, endpoint: "actions" | "mutate", body: JsonObject) {
    this.requireCredentials(credentials);
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded) > 300_000) throw new SanityApiError("provider_validation_error", "Sanity document change exceeds 300 KB.");
    return this.fetch(credentials, this.url(credentials, endpoint), { method: "POST", headers: { "Content-Type": "application/json" }, body: encoded });
  }

  private url(credentials: SanityCredentials, endpoint: string) {
    const projectId = this.identifier(credentials.projectId, "projectId", 100).toLowerCase();
    const dataset = this.identifier(credentials.dataset, "dataset", 100);
    return new URL(`https://${projectId}.api.sanity.io/${this.apiVersion}/data/${endpoint}/${encodeURIComponent(dataset)}`);
  }

  private async fetch(credentials: SanityCredentials, url: URL, init: RequestInit) {
    try {
      const response = await safeConnectorFetch(url, {
        ...init,
        headers: { Accept: "application/json", Authorization: `Bearer ${credentials.apiToken}`, ...(init.headers ?? {}) },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 5_000_000) throw new SanityApiError("provider_validation_error", "Sanity response exceeds 5 MB.");
      let data: unknown = raw.toString("utf8");
      try { data = raw.length ? JSON.parse(raw.toString("utf8")) : null; } catch { /* keep bounded text */ }
      data = this.redact(data);
      if (!response.ok) throw new SanityApiError(this.safeCode(response.status), this.errorMessage(data) ?? `Sanity returned HTTP ${response.status}.`, response.status);
      return data;
    } catch (error) {
      if (error instanceof SanityApiError) throw error;
      throw new SanityApiError("provider_unavailable", "Sanity could not be reached.", 502);
    }
  }

  private requireCredentials(credentials: SanityCredentials) {
    this.identifier(credentials.projectId, "projectId", 100);
    this.identifier(credentials.dataset, "dataset", 100);
    if (!credentials.apiToken || credentials.apiToken.length > 4_000) throw new SanityApiError("credential_missing", "Sanity project ID, dataset, and robot token are required.", 401);
  }

  private fields(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SanityApiError("provider_validation_error", "fields must be an object.");
    const fields = value as JsonObject;
    if (!Object.keys(fields).length || Object.keys(fields).length > 100) throw new SanityApiError("provider_validation_error", "fields must contain between 1 and 100 properties.");
    for (const reserved of ["_id", "_type", "_rev", "_createdAt", "_updatedAt"]) if (reserved in fields) throw new SanityApiError("policy_blocked", `Sanity field ${reserved} is managed by Relay or Sanity.`, 403);
    this.rejectSecretsAndDepth(fields);
    const encoded = JSON.stringify(fields);
    if (Buffer.byteLength(encoded) > 250_000) throw new SanityApiError("provider_validation_error", "Sanity fields exceed 250 KB.");
    return fields;
  }

  private rejectSecretsAndDepth(value: unknown, depth = 0) {
    if (depth > 20) throw new SanityApiError("policy_blocked", "Sanity fields are too deeply nested.", 403);
    if (Array.isArray(value)) return value.forEach((item) => this.rejectSecretsAndDepth(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new SanityApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403);
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

  private errorMessage(value: unknown) {
    const object = this.object(value);
    const nested = this.object(object?.error);
    const candidate = nested?.description ?? nested?.message ?? object?.message ?? object?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private identifier(value: unknown, name: string, maximum: number) { if (typeof value !== "string" || !value.trim() || value.length > maximum || !/^[A-Za-z0-9_.-]+$/.test(value.trim())) throw new SanityApiError("provider_validation_error", `${name} is invalid.`); return value.trim(); }
  private optionalIdentifier(value: unknown, name: string, maximum: number) { return value === undefined || value === null || value === "" ? undefined : this.identifier(value, name, maximum); }
  private publishedId(value: unknown, name: string) { const id = this.identifier(value, name, 200); if (id.startsWith("drafts.") || id.startsWith("versions.") || id.startsWith("_.")) throw new SanityApiError("provider_validation_error", `${name} must be an unprefixed published document ID.`); return id; }
  private optionalPublishedId(value: unknown) { return value === undefined || value === null || value === "" ? undefined : this.publishedId(value, "lastId"); }
  private idempotencyKey(value: unknown) { return this.identifier(value, "idempotencyKey", 200); }
  private enumValue(value: unknown, allowed: string[], name: string) { const selected = String(value ?? ""); if (!allowed.includes(selected)) throw new SanityApiError("provider_validation_error", `${name} is invalid.`); return selected; }
  private integer(value: unknown, fallback: number, minimum: number, maximum: number) { const number = Number(value ?? fallback); if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new SanityApiError("provider_validation_error", `Value must be an integer from ${minimum} to ${maximum}.`); return number; }
  private object(value: unknown): JsonObject | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
  private lastDocumentId(rows: unknown[]) { const last = this.object(rows.at(-1)); return typeof last?._id === "string" ? last._id : null; }
}
