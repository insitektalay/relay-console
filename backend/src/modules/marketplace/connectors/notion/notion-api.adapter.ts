import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export class NotionApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class NotionApiAdapter {
  private readonly baseUrl = "https://api.notion.com/v1";
  private readonly apiVersion = "2026-03-11";

  async getCurrentBot(accessToken: string) {
    const body = this.object(
      await this.request(accessToken, "GET", "/users/me"),
    );
    const id = this.string(body.id);
    if (!id || body.object !== "user")
      throw new NotionApiError(
        "provider_validation_error",
        "Notion connected-bot identity is incomplete",
      );
    return {
      id,
      name: this.string(body.name),
      type: this.string(body.type),
      avatarUrl: this.httpsUrl(body.avatar_url),
    };
  }

  async search(
    accessToken: string,
    queryInput: unknown,
    maxResultsInput: unknown,
  ) {
    const query = this.optionalText(queryInput, "query", 256);
    const maxResults = this.limit(maxResultsInput, 25);
    const envelope = this.object(
      await this.request(accessToken, "POST", "/search", {
        ...(query ? { query } : {}),
        page_size: maxResults,
      }),
    );
    const results = this.array(envelope.results)
      .slice(0, maxResults)
      .map((value) => this.shapeSearchResult(value));
    return {
      query,
      results,
      count: results.length,
      providerRequestCount: 1,
      nextCursorFollowed: false,
      exhaustive: false,
    };
  }

  async getPage(accessToken: string, pageIdInput: unknown) {
    const pageId = this.id(pageIdInput, "pageId");
    const body = this.object(
      await this.request(
        accessToken,
        "GET",
        `/pages/${encodeURIComponent(pageId)}`,
      ),
    );
    return { page: this.shapePage(body), providerRequestCount: 1 };
  }

  async getBlockChildren(
    accessToken: string,
    blockIdInput: unknown,
    maxResultsInput: unknown,
  ) {
    const blockId = this.id(blockIdInput, "blockId");
    const maxResults = this.limit(maxResultsInput, 50);
    const envelope = this.object(
      await this.request(
        accessToken,
        "GET",
        `/blocks/${encodeURIComponent(blockId)}/children`,
        undefined,
        { page_size: String(maxResults) },
      ),
    );
    const blocks = this.array(envelope.results)
      .slice(0, maxResults)
      .map((value) => this.shapeBlock(value));
    return {
      blockId,
      blocks,
      count: blocks.length,
      providerRequestCount: 1,
      nextCursorFollowed: false,
    };
  }

  async createPage(
    accessToken: string,
    input: {
      parentType: unknown;
      parentId: unknown;
      titlePropertyName?: unknown;
      title: unknown;
      children: unknown;
      idempotencyKey: unknown;
    },
  ) {
    const parentType = this.enum(input.parentType, "parentType", [
      "page_id",
      "data_source_id",
    ]);
    const parentId = this.id(input.parentId, "parentId");
    const title = this.requiredText(input.title, "title", 200);
    const titlePropertyName =
      parentType === "data_source_id"
        ? this.requiredText(
            input.titlePropertyName,
            "titlePropertyName",
            200,
          )
        : "title";
    const children = this.blocks(input.children, true);
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const body = this.object(
      await this.request(accessToken, "POST", "/pages", {
        parent: { type: parentType, [parentType]: parentId },
        properties: {
          [titlePropertyName]: {
            type: "title",
            title: [{ type: "text", text: { content: title } }],
          },
        },
        ...(children.length ? { children } : {}),
      }),
    );
    return {
      page: this.shapePage(body),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async appendBlocks(
    accessToken: string,
    input: { blockId: unknown; children: unknown; idempotencyKey: unknown },
  ) {
    const blockId = this.id(input.blockId, "blockId");
    const children = this.blocks(input.children, false);
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const envelope = this.object(
      await this.request(
        accessToken,
        "PATCH",
        `/blocks/${encodeURIComponent(blockId)}/children`,
        { children },
      ),
    );
    const blocks = this.array(envelope.results)
      .slice(0, 50)
      .map((value) => this.shapeBlock(value));
    return {
      blockId,
      blocks,
      count: blocks.length,
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  private async request(
    accessToken: string,
    method: "GET" | "POST" | "PATCH",
    path: string,
    jsonBody?: JsonObject,
    query?: Record<string, string>,
  ) {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {}))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": this.apiVersion,
          ...(jsonBody ? { "Content-Type": "application/json" } : {}),
        },
        body: jsonBody ? JSON.stringify(jsonBody) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new NotionApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Notion request timed out"
          : "Notion request failed",
      );
    }
    const value = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new NotionApiError(
        this.errorCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    return value;
  }

  private shapeSearchResult(value: unknown) {
    const item = this.object(value);
    const id = this.string(item.id);
    const object = this.enum(item.object, "object", ["page", "data_source"]);
    if (!id)
      throw new NotionApiError(
        "provider_validation_error",
        "Notion search result is incomplete",
      );
    return {
      id,
      object,
      url: this.httpsUrl(item.url),
      createdAt: this.isoDate(item.created_time),
      updatedAt: this.isoDate(item.last_edited_time),
      title: this.title(item),
    };
  }
  private shapePage(value: unknown) {
    const page = this.object(value);
    const id = this.string(page.id);
    if (!id || page.object !== "page")
      throw new NotionApiError(
        "provider_validation_error",
        "Notion page response is incomplete",
      );
    return {
      id,
      url: this.httpsUrl(page.url),
      title: this.title(page),
      archived: page.archived === true || page.in_trash === true,
      createdAt: this.isoDate(page.created_time),
      updatedAt: this.isoDate(page.last_edited_time),
      parent: this.object(page.parent),
    };
  }
  private shapeBlock(value: unknown) {
    const block = this.object(value);
    const id = this.string(block.id);
    const type = this.string(block.type);
    if (!id || !type)
      throw new NotionApiError(
        "provider_validation_error",
        "Notion block response is incomplete",
      );
    return {
      id,
      type,
      hasChildren: block.has_children === true,
      archived: block.archived === true || block.in_trash === true,
      createdAt: this.isoDate(block.created_time),
      updatedAt: this.isoDate(block.last_edited_time),
      content: this.object(block[type]),
    };
  }
  private title(value: unknown) {
    const object = this.object(value);
    const properties = this.object(object.properties);
    for (const property of Object.values(properties)) {
      const item = this.object(property);
      const rich = this.array(item.title);
      if (rich.length)
        return rich
          .map((part) => this.string(this.object(part).plain_text) ?? "")
          .join("")
          .slice(0, 500);
    }
    return (
      this.array(object.title)
        .map((part) => this.string(this.object(part).plain_text) ?? "")
        .join("")
        .slice(0, 500) || null
    );
  }
  private blocks(value: unknown, allowEmpty: boolean) {
    if (value === undefined && allowEmpty) return [];
    const blocks = this.array(value);
    if ((!allowEmpty && blocks.length < 1) || blocks.length > 50)
      throw new NotionApiError(
        "provider_validation_error",
        "children must contain between one and fifty blocks",
      );
    const encoded = JSON.stringify(blocks);
    if (encoded.length > 100_000)
      throw new NotionApiError(
        "provider_validation_error",
        "children payload is too large",
      );
    return blocks.map((item) => {
      const block = this.object(item);
      if (typeof block.object !== "string" || typeof block.type !== "string")
        throw new NotionApiError(
          "provider_validation_error",
          "each child must be a typed Notion block",
        );
      return block;
    });
  }
  private id(value: unknown, field: string) {
    const text = this.string(value);
    if (
      !text ||
      !/^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        text,
      )
    )
      throw new NotionApiError(
        "provider_validation_error",
        `${field} must be a Notion UUID`,
      );
    return text;
  }
  private idempotencyKey(value: unknown) {
    const text = this.string(value);
    if (
      !text ||
      text.length < 8 ||
      text.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(text)
    )
      throw new NotionApiError(
        "provider_validation_error",
        "idempotencyKey is invalid",
      );
    return text;
  }
  private requiredText(value: unknown, field: string, max: number) {
    const text = this.string(value)?.trim();
    if (!text || text.length > max)
      throw new NotionApiError(
        "provider_validation_error",
        `${field} is required and must be ${max} characters or fewer`,
      );
    return text;
  }
  private optionalText(value: unknown, field: string, max: number) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredText(value, field, max);
  }
  private limit(value: unknown, max: number) {
    if (value === undefined || value === null) return max;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > max)
      throw new NotionApiError(
        "provider_validation_error",
        `maxResults must be between 1 and ${max}`,
      );
    return Number(value);
  }
  private enum<T extends string>(
    value: unknown,
    field: string,
    values: readonly T[],
  ): T {
    const text = this.string(value);
    if (!text || !values.includes(text as T))
      throw new NotionApiError(
        "provider_validation_error",
        `${field} is invalid`,
      );
    return text as T;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private string(value: unknown) {
    return typeof value === "string" && value.length ? value : null;
  }
  private httpsUrl(value: unknown) {
    const text = this.string(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  private isoDate(value: unknown) {
    const text = this.string(value);
    return text && !Number.isNaN(Date.parse(text))
      ? new Date(text).toISOString()
      : null;
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 409) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private safeMessage(status: number) {
    if (status === 401) return "Notion authorization is invalid or expired";
    if (status === 403)
      return "Notion denied this operation; check connection capabilities and page sharing";
    if (status === 404)
      return "Notion could not access that object; it may not be shared with this connection";
    if (status === 409) return "Notion reported a conflicting edit";
    if (status === 429) return "Notion rate limited this request";
    if (status >= 500) return "Notion is temporarily unavailable";
    return "Notion rejected this request";
  }
}
