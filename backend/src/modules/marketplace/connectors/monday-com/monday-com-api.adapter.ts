import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class MondayComApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MondayComApiAdapter {
  private readonly endpoint = "https://api.monday.com/v2";
  private readonly apiVersion = "2026-04";

  async getIdentity(accessToken: string) {
    const data = await this.graphql(
      accessToken,
      `query RelayIdentity { me { id name email account { id name slug } } }`,
      {},
    );
    const me = this.object(data.me);
    const account = this.object(me.account);
    return {
      userId: this.requiredId(me.id, "me.id"),
      name: this.text(me.name),
      email: this.text(me.email),
      account: {
        id: this.requiredId(account.id, "me.account.id"),
        name: this.text(account.name),
        slug: this.text(account.slug),
      },
      providerRequestCount: 1,
    };
  }

  async listBoards(accessToken: string, input: JsonObject) {
    const maxResults = this.limit(input.maxResults, 20, 25);
    const workspaceId = this.optionalId(input.workspaceId, "workspaceId");
    const data = await this.graphql(
      accessToken,
      `query RelayBoards($limit: Int!, $workspaceIds: [ID!]) {
      boards(limit: $limit, workspace_ids: $workspaceIds, state: active) {
        id name description board_kind state url updated_at items_count workspace { id name }
        groups { id title } columns { id title type }
      }
    }`,
      { limit: maxResults, workspaceIds: workspaceId ? [workspaceId] : null },
    );
    const boards = this.array(data.boards)
      .slice(0, maxResults)
      .map((value) => this.shapeBoard(value));
    return {
      boards,
      count: boards.length,
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async listBoardItems(accessToken: string, input: JsonObject) {
    const boardId = this.requiredId(input.boardId, "boardId");
    const maxResults = this.limit(input.maxResults, 20, 50);
    const query = this.optionalText(input.query, "query", 200)?.toLowerCase();
    const data = await this.graphql(
      accessToken,
      `query RelayBoardItems($boardIds: [ID!]!, $limit: Int!) {
      boards(ids: $boardIds) { id name items_page(limit: $limit) { cursor items {
        id name url created_at updated_at group { id title } creator { id name }
        column_values { id text type }
      } } }
    }`,
      { boardIds: [boardId], limit: 50 },
    );
    const board = this.object(this.array(data.boards)[0]);
    const page = this.object(board.items_page);
    const visible = this.array(page.items).filter(
      (value) =>
        !query ||
        [
          this.text(this.object(value).name),
          ...this.array(this.object(value).column_values).map((column) =>
            this.text(this.object(column).text),
          ),
        ].some((text) => text?.toLowerCase().includes(query)),
    );
    const items = visible
      .slice(0, maxResults)
      .map((value) => this.shapeItem(value));
    return {
      board: { id: boardId, name: this.text(board.name) },
      query: query ?? null,
      items,
      count: items.length,
      cursorReturned: Boolean(this.text(page.cursor)),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async getItem(accessToken: string, input: JsonObject) {
    const itemId = this.requiredId(input.itemId, "itemId");
    const maxUpdateChars = this.limit(input.maxUpdateChars, 4000, 4000);
    const data = await this.graphql(
      accessToken,
      `query RelayItem($ids: [ID!]!) { items(ids: $ids) {
      id name url created_at updated_at board { id name } group { id title } creator { id name }
      column_values { id text type } updates(limit: 10) { id body text_body created_at updated_at creator { id name } replies { id } }
    } }`,
      { ids: [itemId] },
    );
    const item = this.object(this.array(data.items)[0]);
    if (!this.text(item.id))
      throw new MondayComApiError(
        "provider_validation_error",
        "Monday.com item was not found",
        404,
      );
    return {
      item: {
        ...this.shapeItem(item),
        board: this.shapeNamed(item.board),
        updates: this.array(item.updates).map((value) =>
          this.shapeUpdate(value, maxUpdateChars),
        ),
      },
      providerRequestCount: 1,
    };
  }

  async listItemUpdates(accessToken: string, input: JsonObject) {
    const itemId = this.requiredId(input.itemId, "itemId");
    const maxResults = this.limit(input.maxResults, 20, 25);
    const maxBodyChars = this.limit(input.maxBodyChars, 4000, 4000);
    const data = await this.graphql(
      accessToken,
      `query RelayItemUpdates($ids: [ID!]!, $limit: Int!) { items(ids: $ids) { id updates(limit: $limit) { id body text_body created_at updated_at creator { id name } replies { id } } } }`,
      { ids: [itemId], limit: maxResults },
    );
    const item = this.object(this.array(data.items)[0]);
    const updates = this.array(item.updates)
      .slice(0, maxResults)
      .map((value) => this.shapeUpdate(value, maxBodyChars));
    return {
      itemId,
      updates,
      count: updates.length,
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async createItem(accessToken: string, input: JsonObject) {
    const boardId = this.requiredId(input.boardId, "boardId");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const data = await this.graphql(
      accessToken,
      `mutation RelayCreateItem($boardId: ID!, $groupId: String, $name: String!, $columnValues: JSON) {
      create_item(board_id: $boardId, group_id: $groupId, item_name: $name, column_values: $columnValues) { id name url board { id name } }
    }`,
      {
        boardId,
        groupId: this.optionalText(input.groupId, "groupId", 100) ?? null,
        name: this.requiredText(input.name, "name", 512),
        columnValues: this.jsonString(
          input.columnValues,
          "columnValues",
          30_000,
        ),
      },
    );
    return {
      item: this.shapeItem(data.create_item),
      boardId,
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async updateItem(accessToken: string, input: JsonObject) {
    const boardId = this.requiredId(input.boardId, "boardId");
    const itemId = this.requiredId(input.itemId, "itemId");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const name = this.optionalText(input.name, "name", 512);
    const columnValues = this.jsonString(
      input.columnValues,
      "columnValues",
      30_000,
    );
    if (!name && !columnValues)
      throw new MondayComApiError(
        "provider_validation_error",
        "A name or columnValues change is required",
      );
    const fields: string[] = [];
    const variables: JsonObject = { boardId, itemId };
    const declarations = ["$boardId: ID!", "$itemId: ID!"];
    if (name) {
      declarations.push("$name: String!");
      variables.name = name;
      fields.push(
        `rename: change_simple_column_value(board_id: $boardId, item_id: $itemId, column_id: "name", value: $name) { id name url }`,
      );
    }
    if (columnValues) {
      declarations.push("$columnValues: JSON!");
      variables.columnValues = columnValues;
      fields.push(
        "columns: change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id name url }",
      );
    }
    const data = await this.graphql(
      accessToken,
      `mutation RelayUpdateItem(${declarations.join(", ")}) { ${fields.join(" ")} }`,
      variables,
    );
    return {
      item: this.shapeItem(data.columns ?? data.rename),
      boardId,
      itemId,
      changedName: Boolean(name),
      changedColumnIds:
        input.columnValues &&
        typeof input.columnValues === "object" &&
        !Array.isArray(input.columnValues)
          ? Object.keys(input.columnValues as JsonObject)
          : [],
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async addUpdate(accessToken: string, input: JsonObject) {
    const itemId = this.requiredId(input.itemId, "itemId");
    const body = this.requiredText(input.body, "body", 8000);
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const data = await this.graphql(
      accessToken,
      `mutation RelayCreateUpdate($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id body text_body created_at updated_at } }`,
      { itemId, body },
    );
    return {
      update: this.shapeUpdate(data.create_update, 4000),
      itemId,
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  private async graphql(
    accessToken: string,
    query: string,
    variables: JsonObject,
  ): Promise<JsonObject> {
    let response: Response;
    try {
      response = await safeConnectorFetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: accessToken,
          "Content-Type": "application/json",
          "API-Version": this.apiVersion,
        },
        body: JSON.stringify({ query, variables }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new MondayComApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Monday.com request timed out"
          : "Monday.com request failed",
      );
    }
    const envelope = this.object(await response.json().catch(() => ({})));
    const errors = this.array(envelope.errors);
    if (!response.ok || errors.length) {
      const extension = this.object(this.object(errors[0]).extensions);
      const providerCode = (this.text(extension.code) ?? "").toLowerCase();
      const code: MarketplaceConnectorSafeErrorCode =
        response.status === 429 ||
        providerCode.includes("complexity") ||
        providerCode.includes("rate")
          ? "provider_rate_limited"
          : response.status === 401
            ? "token_expired"
            : response.status === 403
              ? "scope_not_granted"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error";
      const message =
        code === "token_expired"
          ? "Monday.com authorization is no longer valid"
          : code === "scope_not_granted"
            ? "Monday.com did not authorize this operation"
            : code === "provider_rate_limited"
              ? "Monday.com rate or complexity limit reached"
              : code === "provider_unavailable"
                ? "Monday.com is temporarily unavailable"
                : "Monday.com rejected the bounded request";
      throw new MondayComApiError(code, message, response.status);
    }
    return this.object(envelope.data);
  }

  private shapeBoard(value: unknown) {
    const board = this.object(value);
    return {
      id: this.requiredId(board.id, "board.id"),
      name: this.text(board.name),
      description: this.truncate(this.text(board.description), 2000),
      kind: this.text(board.board_kind),
      state: this.text(board.state),
      url: this.text(board.url),
      updatedAt: this.text(board.updated_at),
      itemCount:
        typeof board.items_count === "number" ? board.items_count : null,
      workspace: this.shapeNamed(board.workspace),
      groups: this.array(board.groups)
        .slice(0, 50)
        .map((v) => this.shapeNamed(v, "title")),
      columns: this.array(board.columns)
        .slice(0, 100)
        .map((v) => ({
          ...this.shapeNamed(v, "title"),
          type: this.text(this.object(v).type),
        })),
    };
  }
  private shapeItem(value: unknown) {
    const item = this.object(value);
    return {
      id: this.requiredId(item.id, "item.id"),
      name: this.text(item.name),
      url: this.text(item.url),
      createdAt: this.text(item.created_at),
      updatedAt: this.text(item.updated_at),
      group: this.shapeNamed(item.group, "title"),
      creator: this.shapeNamed(item.creator),
      columns: this.array(item.column_values)
        .slice(0, 100)
        .map((v) => ({
          id: this.text(this.object(v).id),
          text: this.truncate(this.text(this.object(v).text), 2000),
          type: this.text(this.object(v).type),
        })),
    };
  }
  private shapeUpdate(value: unknown, max: number) {
    const update = this.object(value);
    return {
      id: this.requiredId(update.id, "update.id"),
      bodyText: this.truncate(
        this.text(update.text_body) ?? this.text(update.body),
        max,
      ),
      createdAt: this.text(update.created_at),
      updatedAt: this.text(update.updated_at),
      creator: this.shapeNamed(update.creator),
      replyCount: this.array(update.replies).length,
    };
  }
  private shapeNamed(value: unknown, nameField = "name") {
    const object = this.object(value);
    return this.text(object.id)
      ? { id: this.text(object.id), name: this.text(object[nameField]) }
      : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown): string | null {
    return typeof value === "string" && value.trim()
      ? value.trim()
      : typeof value === "number"
        ? String(value)
        : null;
  }
  private requiredId(value: unknown, field: string) {
    const id = this.text(value);
    if (!id || id.length > 100)
      throw new MondayComApiError(
        "provider_validation_error",
        `${field} is required`,
      );
    return id;
  }
  private optionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredId(value, field);
  }
  private requiredText(value: unknown, field: string, max: number) {
    const text = this.text(value);
    if (!text || text.length > max)
      throw new MondayComApiError(
        "provider_validation_error",
        `${field} must be between 1 and ${max} characters`,
      );
    return text;
  }
  private optionalText(value: unknown, field: string, max: number) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredText(value, field, max);
  }
  private limit(value: unknown, fallback: number, max: number) {
    if (value === undefined || value === null) return fallback;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > max)
      throw new MondayComApiError(
        "provider_validation_error",
        `limit must be between 1 and ${max}`,
      );
    return Number(value);
  }
  private jsonString(value: unknown, field: string, max: number) {
    if (value === undefined || value === null) return null;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new MondayComApiError(
        "provider_validation_error",
        `${field} must be an object`,
      );
    const encoded = JSON.stringify(value);
    if (encoded.length > max)
      throw new MondayComApiError(
        "provider_validation_error",
        `${field} is too large`,
      );
    return encoded;
  }
  private idempotencyKey(value: unknown) {
    const key = this.requiredText(value, "idempotencyKey", 128);
    if (key.length < 8)
      throw new MondayComApiError(
        "provider_validation_error",
        "idempotencyKey must have at least 8 characters",
      );
    return key;
  }
  private truncate(value: string | null, max: number) {
    return value && value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }
}
