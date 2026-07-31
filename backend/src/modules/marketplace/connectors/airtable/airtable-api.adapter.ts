import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class AirtableApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AirtableApiAdapter {
  private readonly origin = "https://api.airtable.com";

  async getIdentity(token: string) {
    const value = await this.request(token, "GET", "/v0/meta/whoami");
    return {
      userId: this.required(value.id, "user id"),
      email: this.text(value.email),
      scopes: this.strings(value.scopes),
      providerRequestCount: 1,
    };
  }

  async listBases(token: string, input: JsonObject) {
    const max = this.limit(input.maxResults, 20, 25);
    const value = await this.request(
      token,
      "GET",
      `/v0/meta/bases?${new URLSearchParams({ offset: "", pageSize: String(max) }).toString().replace("offset=&", "")}`,
    );
    const bases = this.array(value.bases)
      .slice(0, max)
      .map((entry) => {
        const base = this.object(entry);
        return {
          id: this.text(base.id),
          name: this.text(base.name),
          permissionLevel: this.text(base.permissionLevel),
        };
      });
    return {
      bases,
      count: bases.length,
      offsetReturned: Boolean(this.text(value.offset)),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async getBaseSchema(token: string, input: JsonObject) {
    const baseId = this.id(input.baseId, "baseId");
    const max = this.limit(input.maxTables, 20, 25);
    const value = await this.request(
      token,
      "GET",
      `/v0/meta/bases/${this.path(baseId)}/tables`,
    );
    const tables = this.array(value.tables)
      .slice(0, max)
      .map((entry) => this.shapeTable(entry));
    return {
      baseId,
      tables,
      count: tables.length,
      truncated: this.array(value.tables).length > max,
      providerRequestCount: 1,
    };
  }

  async listRecords(token: string, input: JsonObject) {
    const baseId = this.id(input.baseId, "baseId");
    const tableId = this.id(input.tableId, "tableId");
    const max = this.limit(input.maxResults, 20, 50);
    const params = new URLSearchParams({
      pageSize: String(max),
      returnFieldsByFieldId: "true",
    });
    const viewId = this.optional(input.viewId, "viewId", 180);
    if (viewId) params.set("view", viewId);
    const value = await this.request(
      token,
      "GET",
      `/v0/${this.path(baseId)}/${this.path(tableId)}?${params}`,
    );
    const records = this.array(value.records)
      .slice(0, max)
      .map((entry) => this.shapeRecord(entry));
    return {
      baseId,
      tableId,
      records,
      count: records.length,
      offsetReturned: Boolean(this.text(value.offset)),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async getRecord(token: string, input: JsonObject) {
    const baseId = this.id(input.baseId, "baseId"),
      tableId = this.id(input.tableId, "tableId"),
      recordId = this.id(input.recordId, "recordId");
    const value = await this.request(
      token,
      "GET",
      `/v0/${this.path(baseId)}/${this.path(tableId)}/${this.path(recordId)}?returnFieldsByFieldId=true`,
    );
    return {
      baseId,
      tableId,
      record: this.shapeRecord(value),
      providerRequestCount: 1,
    };
  }

  async listComments(token: string, input: JsonObject) {
    const baseId = this.id(input.baseId, "baseId"),
      tableId = this.id(input.tableId, "tableId"),
      recordId = this.id(input.recordId, "recordId");
    const max = this.limit(input.maxResults, 20, 25),
      chars = this.limit(input.maxTextChars, 2000, 4000);
    const value = await this.request(
      token,
      "GET",
      `/v0/${this.path(baseId)}/${this.path(tableId)}/${this.path(recordId)}/comments?pageSize=${max}`,
    );
    const comments = this.array(value.comments)
      .slice(0, max)
      .map((entry) => this.shapeComment(entry, chars));
    return {
      baseId,
      tableId,
      recordId,
      comments,
      count: comments.length,
      offsetReturned: Boolean(this.text(value.offset)),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async createRecord(token: string, input: JsonObject) {
    const baseId = this.id(input.baseId, "baseId"),
      tableId = this.id(input.tableId, "tableId"),
      fields = this.fields(input.fields),
      idempotencyKey = this.key(input.idempotencyKey);
    const value = await this.request(
      token,
      "POST",
      `/v0/${this.path(baseId)}/${this.path(tableId)}`,
      {
        fields,
        typecast: input.typecast === true,
        returnFieldsByFieldId: true,
      },
    );
    return {
      baseId,
      tableId,
      record: this.shapeRecord(value),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async updateRecord(token: string, input: JsonObject) {
    const baseId = this.id(input.baseId, "baseId"),
      tableId = this.id(input.tableId, "tableId"),
      recordId = this.id(input.recordId, "recordId"),
      fields = this.fields(input.fields),
      idempotencyKey = this.key(input.idempotencyKey);
    const value = await this.request(
      token,
      "PATCH",
      `/v0/${this.path(baseId)}/${this.path(tableId)}/${this.path(recordId)}`,
      {
        fields,
        typecast: input.typecast === true,
        returnFieldsByFieldId: true,
      },
    );
    return {
      baseId,
      tableId,
      recordId,
      record: this.shapeRecord(value),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async addComment(token: string, input: JsonObject) {
    const baseId = this.id(input.baseId, "baseId"),
      tableId = this.id(input.tableId, "tableId"),
      recordId = this.id(input.recordId, "recordId"),
      text = this.requiredText(input.comment, "comment", 8000),
      idempotencyKey = this.key(input.idempotencyKey);
    const parentCommentId = this.optional(
      input.parentCommentId,
      "parentCommentId",
      180,
    );
    const value = await this.request(
      token,
      "POST",
      `/v0/${this.path(baseId)}/${this.path(tableId)}/${this.path(recordId)}/comments`,
      { text, ...(parentCommentId ? { parentCommentId } : {}) },
    );
    return {
      baseId,
      tableId,
      recordId,
      comment: this.shapeComment(value, 4000),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  private async request(
    token: string,
    method: string,
    path: string,
    body?: JsonObject,
  ): Promise<JsonObject> {
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.origin}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new AirtableApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Airtable request timed out"
          : "Airtable request failed",
      );
    }
    const value = await this.json(response);
    if (!response.ok) {
      const code: MarketplaceConnectorSafeErrorCode =
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status === 404 || response.status === 422
                ? "provider_validation_error"
                : "provider_unavailable";
      throw new AirtableApiError(
        code,
        response.status === 429
          ? "Airtable rate limit reached"
          : "Airtable API rejected the request",
        response.status,
      );
    }
    return value;
  }
  private async json(response: Response) {
    try {
      return this.object(await response.json());
    } catch {
      return {};
    }
  }
  private shapeTable(value: unknown) {
    const table = this.object(value);
    return {
      id: this.text(table.id),
      name: this.text(table.name),
      primaryFieldId: this.text(table.primaryFieldId),
      fields: this.array(table.fields)
        .slice(0, 100)
        .map((entry) => {
          const field = this.object(entry);
          return {
            id: this.text(field.id),
            name: this.text(field.name),
            type: this.text(field.type),
          };
        }),
      views: this.array(table.views)
        .slice(0, 50)
        .map((entry) => {
          const view = this.object(entry);
          return {
            id: this.text(view.id),
            name: this.text(view.name),
            type: this.text(view.type),
          };
        }),
    };
  }
  private shapeRecord(value: unknown) {
    const record = this.object(value);
    return {
      id: this.text(record.id),
      createdTime: this.text(record.createdTime),
      fields: this.safe(record.fields, 40_000),
    };
  }
  private shapeComment(value: unknown, chars: number) {
    const comment = this.object(value),
      author = this.object(comment.author);
    return {
      id: this.text(comment.id),
      textExcerpt: this.text(comment.text)?.slice(0, chars) ?? null,
      createdTime: this.text(comment.createdTime),
      lastUpdatedTime: this.text(comment.lastUpdatedTime),
      parentCommentId: this.text(comment.parentCommentId),
      author: { id: this.text(author.id), name: this.text(author.name) },
      reactionCount: this.array(comment.reactions).length,
    };
  }
  private safe(value: unknown, limit: number) {
    const encoded = JSON.stringify(value ?? {});
    return encoded.length <= limit
      ? (value ?? {})
      : { truncated: true, preview: encoded.slice(0, limit) };
  }
  private fields(value: unknown) {
    const fields = this.object(value);
    if (!Object.keys(fields).length || JSON.stringify(fields).length > 30_000)
      throw new AirtableApiError(
        "provider_validation_error",
        "Airtable fields are required and must fit Relay bounds",
      );
    return fields;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private strings(value: unknown) {
    return this.array(value).map(String).filter(Boolean);
  }
  private text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private required(value: unknown, label: string) {
    const text = this.text(value);
    if (!text)
      throw new AirtableApiError(
        "provider_validation_error",
        `Airtable ${label} is missing`,
      );
    return text;
  }
  private requiredText(value: unknown, label: string, max: number) {
    const text = this.required(value, label);
    if (text.length > max)
      throw new AirtableApiError(
        "provider_validation_error",
        `Airtable ${label} is too large`,
      );
    return text;
  }
  private optional(value: unknown, label: string, max: number) {
    const text = this.text(value);
    if (text && text.length > max)
      throw new AirtableApiError(
        "provider_validation_error",
        `Airtable ${label} is too large`,
      );
    return text;
  }
  private id(value: unknown, label: string) {
    const text = this.requiredText(value, label, 180);
    if (!/^[A-Za-z0-9_-]+$/.test(text))
      throw new AirtableApiError(
        "provider_validation_error",
        `Airtable ${label} is invalid`,
      );
    return text;
  }
  private key(value: unknown) {
    return this.requiredText(value, "idempotencyKey", 180);
  }
  private path(value: string) {
    return encodeURIComponent(value);
  }
  private limit(value: unknown, fallback: number, max: number) {
    const number = Number(value);
    return Number.isInteger(number)
      ? Math.max(1, Math.min(max, number))
      : fallback;
  }
}
