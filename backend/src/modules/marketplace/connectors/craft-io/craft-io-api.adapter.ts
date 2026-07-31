import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type CraftIoCredentials = {
  apiKey: string;
  accountId: string;
  region: string;
};

export class CraftIoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CraftIoApiAdapter {
  async health(credentials: CraftIoCredentials) {
    const result = await this.listWorkspaces(credentials, { limit: 1 });
    return {
      region: this.region(credentials.region),
      workspaceCount: result.count,
    };
  }

  async listWorkspaces(credentials: CraftIoCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const accountId = this.id(credentials.accountId, "account");
    const parsed = await this.request(
      credentials,
      `/workspaces/${accountId}`,
      "GET",
    );
    const source = this.collection(parsed, "workspaces");
    const rows = source.slice(0, limit).map((item) => this.workspace(item));
    return { rows, count: rows.length, truncated: source.length > limit };
  }

  async listItems(credentials: CraftIoCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const workspaceId = this.id(input.workspaceId, "workspace");
    const query = new URLSearchParams({
      fields:
        "id,type,workspaceId,portfolioId,shortId,title,status,importance,createdAt,updatedAt",
      page: "1",
      limit: String(limit),
    });
    if (input.keyword !== undefined)
      query.set("keyword", this.requiredText(input.keyword, "keyword", 2, 80));
    const parsed = await this.request(
      credentials,
      `/workspace/${workspaceId}/items?${query.toString()}`,
      "GET",
    );
    const source = this.collection(parsed, "items");
    const rows = source.slice(0, limit).map((item) => this.item(item));
    return {
      rows,
      count: rows.length,
      truncated: this.hasMore(parsed, source.length, limit),
    };
  }

  async getItem(credentials: CraftIoCredentials, input: JsonObject) {
    const itemId = this.id(input.itemId, "item");
    const query = new URLSearchParams({
      fields:
        "id,type,workspaceId,portfolioId,shortId,title,status,importance,createdAt,updatedAt",
    });
    return this.item(
      await this.request(
        credentials,
        `/item/${itemId}?${query.toString()}`,
        "GET",
      ),
    );
  }

  async listFeedbackPortals(
    credentials: CraftIoCredentials,
    input: JsonObject,
  ) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const accountId = this.id(credentials.accountId, "account");
    const parsed = await this.request(
      credentials,
      `/feedback_portals/${accountId}`,
      "GET",
    );
    const source = this.collection(parsed, "portals");
    const rows = source.slice(0, limit).map((item) => this.portal(item));
    return { rows, count: rows.length, truncated: source.length > limit };
  }

  async listFeedbackCategories(
    credentials: CraftIoCredentials,
    input: JsonObject,
  ) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const portalId = this.id(input.portalId, "feedback portal");
    const parsed = await this.request(
      credentials,
      `/feedback_portal/${portalId}/categories`,
      "GET",
    );
    const source = this.collection(parsed, "categories");
    const rows = source.slice(0, limit).map((item) => this.category(item));
    return { rows, count: rows.length, truncated: source.length > limit };
  }

  async listFeedbackItems(credentials: CraftIoCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const portalId = this.id(input.portalId, "feedback portal");
    const query = new URLSearchParams({ page: "1", limit: String(limit) });
    if (input.keyword !== undefined)
      query.set("keyword", this.requiredText(input.keyword, "keyword", 2, 80));
    const parsed = await this.request(
      credentials,
      `/feedback_portal/${portalId}/feedback_items?${query.toString()}`,
      "GET",
    );
    const source = this.collection(parsed, "items");
    const rows = source.slice(0, limit).map((item) => this.feedback(item));
    return {
      rows,
      count: rows.length,
      truncated: this.hasMore(parsed, source.length, limit),
    };
  }

  async getFeedbackItem(credentials: CraftIoCredentials, input: JsonObject) {
    return this.feedback(
      await this.request(
        credentials,
        `/feedback_item/${this.id(input.feedbackItemId, "feedback item")}`,
        "GET",
      ),
    );
  }

  async submitPlainFeedback(
    credentials: CraftIoCredentials,
    input: JsonObject,
  ) {
    const portalId = this.id(input.portalId, "feedback portal");
    const result = await this.request(
      credentials,
      `/feedback_portal/${portalId}/plain_feedback`,
      "POST",
      {
        workspaceId: this.id(input.workspaceId, "workspace"),
        title: this.requiredText(input.title, "title", 1, 200),
        description: this.requiredText(
          input.description,
          "description",
          1,
          4000,
        ),
        owner: this.email(input.submitterEmail),
        categoryId: this.id(input.categoryId, "category"),
      },
    );
    return this.feedbackReference(result);
  }

  private async request(
    credentials: CraftIoCredentials,
    path: string,
    method: "GET" | "POST",
    body?: JsonObject,
  ) {
    this.assertKey(credentials.apiKey);
    const origin = this.origin(credentials.region);
    let response: Response;
    try {
      response = await safeConnectorFetch(`${origin}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0",
          "x-api-key": credentials.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new CraftIoApiError(
        "provider_unavailable",
        "Craft.io could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid("Craft.io response exceeded the 256 KiB Relay limit.");
    let parsed: unknown = null;
    if (raw.byteLength) {
      try {
        parsed = JSON.parse(raw.toString("utf8"));
      } catch {
        throw new CraftIoApiError(
          response.ok ? "provider_unavailable" : this.safeCode(response.status),
          "Craft.io returned invalid JSON.",
          response.status,
        );
      }
    }
    if (!response.ok)
      throw new CraftIoApiError(
        this.safeCode(response.status),
        "Craft.io rejected the fixed API request.",
        response.status,
      );
    return parsed;
  }

  private workspace(value: unknown) {
    const item = this.unwrap(value, "workspace");
    const id = this.textOrNumber(item?.id, 100);
    const name = this.text(item?.name, 200);
    if (!item || !id || !name)
      throw this.invalid("Craft.io returned an invalid workspace.");
    return { id, name };
  }

  private item(value: unknown) {
    const source = this.unwrap(value, "item");
    const id = this.textOrNumber(source?.id, 100);
    const title = this.text(source?.title, 200);
    if (!source || !id || !title)
      throw this.invalid("Craft.io returned an invalid work item.");
    return {
      id,
      shortId: this.text(source.shortId ?? source.short_id, 80),
      type: this.text(source.type, 80),
      title,
      workspaceId: this.textOrNumber(
        source.workspaceId ?? source.workspace_id,
        100,
      ),
      portfolioId: this.textOrNumber(
        source.portfolioId ?? source.portfolio_id,
        100,
      ),
      status: this.namedValue(source.status),
      importance: this.namedValue(source.importance),
      createdAt: this.text(source.createdAt ?? source.created_at, 40),
      updatedAt: this.text(source.updatedAt ?? source.updated_at, 40),
    };
  }

  private portal(value: unknown) {
    const item = this.unwrap(value, "portal");
    const id = this.textOrNumber(item?.id, 100);
    const name = this.text(item?.name ?? item?.title, 200);
    if (!item || !id || !name)
      throw this.invalid("Craft.io returned an invalid feedback portal.");
    return { id, name };
  }

  private category(value: unknown) {
    const item = this.unwrap(value, "category");
    const id = this.textOrNumber(item?.id, 100);
    const name = this.text(item?.name ?? item?.title, 200);
    if (!item || !id || !name)
      throw this.invalid("Craft.io returned an invalid feedback category.");
    return { id, name };
  }

  private feedback(value: unknown) {
    const item = this.unwrap(value, "feedbackItem");
    const id = this.textOrNumber(item?.id, 100);
    const title = this.text(item?.title, 200);
    if (!item || !id || !title)
      throw this.invalid("Craft.io returned an invalid feedback item.");
    return {
      id,
      portalId: this.textOrNumber(item.portalId ?? item.portal_id, 100),
      shortId: this.text(item.shortId ?? item.short_id, 80),
      title,
      status: this.namedValue(item.status),
      internalStatus: this.namedValue(
        item.internalStatus ?? item.internal_status,
      ),
      category: this.namedValue(item.category),
      importance: this.namedValue(item.importance),
      createdAt: this.text(item.createdAt ?? item.created_at, 40),
      updatedAt: this.text(item.updatedAt ?? item.updated_at, 40),
    };
  }

  private feedbackReference(value: unknown) {
    const item = this.unwrap(value, "feedbackItem");
    const id = this.textOrNumber(item?.id, 100);
    if (!item || !id)
      throw this.invalid("Craft.io returned an invalid feedback reference.");
    return {
      id,
      shortId: this.text(item.shortId ?? item.short_id, 80),
      link: this.httpsUrl(item.link),
    };
  }

  private collection(value: unknown, key: string): unknown[] {
    if (Array.isArray(value)) return value;
    const object = this.object(value);
    const named = object?.[key];
    if (Array.isArray(named)) return named;
    if (Array.isArray(object?.data)) return object.data;
    throw this.invalid(`Craft.io returned an invalid ${key} list.`);
  }
  private hasMore(value: unknown, length: number, limit: number) {
    const object = this.object(value);
    const pagination = this.object(object?.pagination ?? object?.metadata);
    return (
      pagination?.hasMore === true ||
      pagination?.has_more === true ||
      (typeof pagination?.total === "number" && pagination.total > limit) ||
      length > limit
    );
  }
  private namedValue(value: unknown) {
    if (typeof value === "string") return value.slice(0, 120);
    const object = this.object(value);
    if (!object) return null;
    return {
      id: this.textOrNumber(object.id, 100),
      name: this.text(object.name ?? object.title, 120),
    };
  }
  private unwrap(value: unknown, key: string) {
    const object = this.object(value);
    if (!object) return null;
    return this.object(object[key]) ?? this.object(object.data) ?? object;
  }
  private origin(region: string) {
    return this.region(region) === "eu"
      ? "https://api-eu.craft.io"
      : "https://api.craft.io";
  }
  private region(value: unknown) {
    const region = String(value ?? "").toLowerCase();
    if (region !== "us" && region !== "eu")
      throw this.invalid("Craft.io region must be us or eu.");
    return region;
  }
  private assertKey(key: string) {
    if (!key || key.length < 20 || key.length > 500 || /[\s\u0000]/.test(key))
      throw new CraftIoApiError(
        "credential_missing",
        "A valid Craft.io account API key is required.",
        401,
      );
  }
  private id(value: unknown, label: string) {
    const id = String(value ?? "");
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id))
      throw this.invalid(`Craft.io ${label} ID is invalid.`);
    return id;
  }
  private integer(value: unknown, min: number, max: number, fallback: number) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max)
      throw this.invalid(`Craft.io integer must be between ${min} and ${max}.`);
    return parsed;
  }
  private requiredText(
    value: unknown,
    label: string,
    min: number,
    max: number,
  ) {
    const text = String(value ?? "").trim();
    if (text.length < min || text.length > max || /\u0000/.test(text))
      throw this.invalid(`Craft.io ${label} is invalid.`);
    return text;
  }
  private email(value: unknown) {
    const email = String(value ?? "")
      .trim()
      .toLowerCase();
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      /[\u0000\r\n]/.test(email)
    )
      throw this.invalid("Craft.io submitterEmail is invalid.");
    return email;
  }
  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private textOrNumber(value: unknown, max: number) {
    if (typeof value === "string") return value.slice(0, max);
    if (typeof value === "number" && Number.isSafeInteger(value))
      return String(value);
    return null;
  }
  private httpsUrl(value: unknown) {
    if (typeof value !== "string" || value.length > 500) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  private invalid(message: string) {
    return new CraftIoApiError("provider_validation_error", message, 400);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "policy_blocked";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
