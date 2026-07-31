import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class MiroApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MiroApiAdapter {
  private readonly origin = "https://api.miro.com";

  async listBoards(token: string, input: JsonObject) {
    const maxResults = this.limit(input.maxResults, 20, 50);
    const value = await this.request(token, "GET", "/v2/boards", {
      ...(this.optionalId(input.teamId)
        ? { team_id: this.optionalId(input.teamId)! }
        : {}),
      ...(this.optionalId(input.projectId)
        ? { project_id: this.optionalId(input.projectId)! }
        : {}),
      ...(this.optionalText(input.query, 500)
        ? { query: this.optionalText(input.query, 500)! }
        : {}),
      ...(this.optionalId(input.ownerId)
        ? { owner: this.optionalId(input.ownerId)! }
        : {}),
      limit: String(maxResults),
      offset: String(this.offset(input.offset)),
      sort: this.sort(input.sort),
    });
    const boards = this.array(value.data)
      .slice(0, maxResults)
      .map((item) => this.board(item));
    return {
      boards,
      count: boards.length,
      offset: this.offset(input.offset),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  async getBoard(token: string, input: JsonObject) {
    const boardId = this.id(input.boardId, "boardId");
    return {
      board: this.board(
        await this.request(token, "GET", `/v2/boards/${this.segment(boardId)}`),
      ),
      providerRequestCount: 1,
    };
  }
  async listBoardItems(token: string, input: JsonObject) {
    const boardId = this.id(input.boardId, "boardId"),
      maxResults = this.itemLimit(input.maxResults),
      type = this.itemFilter(input.itemType),
      cursor = this.optionalText(input.cursor, 2000),
      parentItemId = this.optionalId(input.parentItemId);
    const value = await this.request(
      token,
      "GET",
      `/v2/boards/${this.segment(boardId)}/items`,
      {
        limit: String(maxResults),
        ...(type ? { type } : {}),
        ...(cursor ? { cursor } : {}),
        ...(parentItemId ? { parent_item_id: parentItemId } : {}),
      },
    );
    const items = this.array(value.data)
      .slice(0, maxResults)
      .map((item) => this.item(item, boardId));
    return {
      boardId,
      items,
      count: items.length,
      cursor: this.text(value.cursor),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  async getBoardItem(token: string, input: JsonObject) {
    const boardId = this.id(input.boardId, "boardId"),
      itemId = this.id(input.itemId, "itemId");
    return {
      item: this.item(
        await this.request(
          token,
          "GET",
          `/v2/boards/${this.segment(boardId)}/items/${this.segment(itemId)}`,
        ),
        boardId,
      ),
      providerRequestCount: 1,
    };
  }
  prepareItemChange(input: JsonObject) {
    const change = this.change(input, this.operation(input.operation));
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerMutation: false,
      providerRequestCount: 0,
    };
  }
  async createStickyNote(token: string, input: JsonObject) {
    return this.create(token, input, "sticky_note");
  }
  async createCard(token: string, input: JsonObject) {
    return this.create(token, input, "card");
  }
  async updateItem(token: string, input: JsonObject) {
    const change = this.change(input, "update"),
      type = this.itemType(change.itemType),
      boardId = String(change.boardId),
      itemId = String(change.itemId);
    const value = await this.request(
      token,
      "PATCH",
      `/v2/boards/${this.segment(boardId)}/${this.route(type)}/${this.segment(itemId)}`,
      {},
      this.body(change, type),
    );
    return this.writeResult("update", input, this.item(value, boardId));
  }

  private async create(
    token: string,
    input: JsonObject,
    operation: "sticky_note" | "card",
  ) {
    const change = this.change(input, operation),
      boardId = String(change.boardId),
      type = operation === "card" ? "card" : "sticky_note";
    const value = await this.request(
      token,
      "POST",
      `/v2/boards/${this.segment(boardId)}/${this.route(type)}`,
      {},
      this.body(change, type),
    );
    return this.writeResult(operation, input, this.item(value, boardId));
  }
  private async request(
    token: string,
    method: string,
    path: string,
    query: Record<string, string> = {},
    body?: JsonObject,
  ): Promise<JsonObject> {
    if (!token || token.length > 10000)
      throw new MiroApiError(
        "credential_missing",
        "A Miro OAuth access token is required.",
        401,
      );
    if (!/^\/v[12]\//.test(path) || path.includes("..") || path.includes("//"))
      throw new MiroApiError(
        "provider_validation_error",
        "Miro API path is invalid.",
      );
    const url = new URL(`${this.origin}${path}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    const encoded = body ? JSON.stringify(body) : undefined;
    if (encoded && Buffer.byteLength(encoded) > 100000)
      throw new MiroApiError(
        "provider_validation_error",
        "Miro request exceeds 100 KB.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(encoded ? { "Content-Type": "application/json" } : {}),
        },
        body: encoded,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new MiroApiError(
        "provider_unavailable",
        "Miro could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (raw.length > 4000000)
      throw new MiroApiError(
        "provider_validation_error",
        "Miro response exceeded Relay bounds.",
      );
    let value: JsonObject = {};
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      value = {};
    }
    if (!response.ok)
      throw new MiroApiError(
        this.code(response.status),
        response.status === 429
          ? "Miro rate limit reached; retry later."
          : response.status === 401
            ? "Miro authorization expired; reconnect the account."
            : response.status === 403
              ? "Miro denied the requested scope or board permission."
              : "Miro rejected the request.",
        response.status,
      );
    return value;
  }
  private change(
    input: JsonObject,
    operation: "sticky_note" | "card" | "update",
  ) {
    const change: JsonObject = {
      operation,
      boardId: this.id(input.boardId, "boardId"),
      content: this.requiredText(input.content, "content", 5000),
    };
    if (operation === "update") {
      change.itemId = this.id(input.itemId, "itemId");
      change.itemType = this.itemType(input.itemType);
    }
    const title = this.optionalText(input.title, 255),
      parentId = this.optionalId(input.parentId);
    if (title) change.title = title;
    if (parentId) change.parentId = parentId;
    for (const key of ["x", "y", "width", "height"] as const) {
      const value = this.number(input[key], key);
      if (value !== null) change[key] = value;
    }
    if (
      change.width !== undefined &&
      change.height !== undefined &&
      operation === "sticky_note"
    )
      throw new MiroApiError(
        "provider_validation_error",
        "Miro sticky notes accept width or height, not both.",
      );
    return change;
  }
  private body(
    change: JsonObject,
    type: "sticky_note" | "card" | "text" | "shape",
  ) {
    const content = String(change.content),
      title = this.text(change.title);
    const data =
      type === "card"
        ? { title: title ?? content.slice(0, 255), description: content }
        : { content };
    const position =
      change.x !== undefined || change.y !== undefined
        ? {
            ...(change.x !== undefined ? { x: change.x } : {}),
            ...(change.y !== undefined ? { y: change.y } : {}),
            origin: "center",
          }
        : undefined;
    const geometry =
      change.width !== undefined || change.height !== undefined
        ? {
            ...(change.width !== undefined ? { width: change.width } : {}),
            ...(change.height !== undefined ? { height: change.height } : {}),
          }
        : undefined;
    return {
      data,
      ...(position ? { position } : {}),
      ...(geometry ? { geometry } : {}),
      ...(change.parentId ? { parent: { id: change.parentId } } : {}),
    };
  }
  private writeResult(operation: string, input: JsonObject, item: JsonObject) {
    return {
      operation,
      item,
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }
  private board(value: unknown) {
    const board = this.object(value),
      owner = this.object(board.owner),
      team = this.object(board.team),
      policy = this.object(board.policy);
    return {
      id: this.text(board.id),
      name: this.text(board.name),
      description: this.bounded(this.text(board.description), 5000),
      viewLink: this.text(board.viewLink) ?? this.text(board.view_link),
      owner: { id: this.text(owner.id), name: this.text(owner.name) },
      team: { id: this.text(team.id), name: this.text(team.name) },
      policy,
      createdAt: this.text(board.createdAt) ?? this.text(board.created_at),
      modifiedAt: this.text(board.modifiedAt) ?? this.text(board.modified_at),
    };
  }
  private item(value: unknown, boardId: string) {
    const item = this.object(value),
      data = this.object(item.data),
      style = this.object(item.style),
      position = this.object(item.position),
      geometry = this.object(item.geometry),
      parent = this.object(item.parent),
      createdBy = this.object(item.createdBy ?? item.created_by),
      modifiedBy = this.object(item.modifiedBy ?? item.modified_by);
    return {
      id: this.text(item.id),
      boardId,
      itemType: this.text(item.type),
      content: this.bounded(
        this.text(data.content) ?? this.text(data.description),
        20000,
      ),
      title: this.bounded(this.text(data.title), 1000),
      style,
      position: {
        x: this.numeric(position.x),
        y: this.numeric(position.y),
        origin: this.text(position.origin),
      },
      geometry: {
        width: this.numeric(geometry.width),
        height: this.numeric(geometry.height),
        rotation: this.numeric(geometry.rotation),
      },
      parent: { id: this.text(parent.id) },
      createdBy: {
        id: this.text(createdBy.id),
        name: this.text(createdBy.name),
      },
      modifiedBy: {
        id: this.text(modifiedBy.id),
        name: this.text(modifiedBy.name),
      },
      createdAt: this.text(item.createdAt) ?? this.text(item.created_at),
      modifiedAt: this.text(item.modifiedAt) ?? this.text(item.modified_at),
    };
  }
  private operation(value: unknown): "sticky_note" | "card" | "update" {
    if (value === "sticky_note" || value === "card" || value === "update")
      return value;
    throw new MiroApiError(
      "provider_validation_error",
      "Miro operation must be sticky_note, card, or update.",
    );
  }
  private itemType(value: unknown): "sticky_note" | "card" | "text" | "shape" {
    if (
      value === "sticky_note" ||
      value === "card" ||
      value === "text" ||
      value === "shape"
    )
      return value;
    throw new MiroApiError(
      "provider_validation_error",
      "Miro itemType must be sticky_note, card, text, or shape.",
    );
  }
  private route(type: "sticky_note" | "card" | "text" | "shape") {
    return type === "sticky_note" ? "sticky_notes" : `${type}s`;
  }
  private itemFilter(value: unknown) {
    const allowed = [
      "app_card",
      "card",
      "document",
      "embed",
      "frame",
      "image",
      "shape",
      "sticky_note",
      "text",
    ];
    const type = this.text(value);
    if (type && !allowed.includes(type))
      throw new MiroApiError(
        "provider_validation_error",
        "Miro itemType filter is invalid.",
      );
    return type;
  }
  private sort(value: unknown) {
    const sort = this.text(value) ?? "default";
    if (
      ![
        "default",
        "last_modified",
        "last_opened",
        "last_created",
        "alphabetically",
      ].includes(sort)
    )
      throw new MiroApiError(
        "provider_validation_error",
        "Miro board sort is invalid.",
      );
    return sort;
  }
  private id(value: unknown, field: string) {
    const id = this.text(value);
    if (!id || !/^[A-Za-z0-9._:@%+=~-]{1,500}$/.test(id))
      throw new MiroApiError(
        "provider_validation_error",
        `Miro ${field} is invalid.`,
      );
    return id;
  }
  private optionalId(value: unknown) {
    return this.text(value) ? this.id(value, "identifier") : null;
  }
  private segment(value: string) {
    return encodeURIComponent(value);
  }
  private requiredText(value: unknown, field: string, max: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > max)
      throw new MiroApiError(
        "provider_validation_error",
        `Miro ${field} is invalid.`,
      );
    return text;
  }
  private optionalText(value: unknown, max: number) {
    const text = this.text(value);
    if (text && text.length > max)
      throw new MiroApiError(
        "provider_validation_error",
        "Miro optional value is too long.",
      );
    return text;
  }
  private key(value: unknown) {
    const key = this.text(value);
    if (!key || key.length > 180)
      throw new MiroApiError(
        "provider_validation_error",
        "Miro idempotencyKey is required.",
      );
    return key;
  }
  private number(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    const number = Number(value),
      coordinate = field === "x" || field === "y";
    if (
      !Number.isFinite(number) ||
      (coordinate ? Math.abs(number) > 1000000 : number <= 0 || number > 50000)
    )
      throw new MiroApiError(
        "provider_validation_error",
        `Miro ${field} is invalid.`,
      );
    return number;
  }
  private numeric(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private limit(value: unknown, fallback: number, max: number) {
    const number = Number(value);
    return Number.isInteger(number)
      ? Math.max(1, Math.min(max, number))
      : fallback;
  }
  private itemLimit(value: unknown) {
    const number = Number(value);
    return Number.isInteger(number) ? Math.max(10, Math.min(50, number)) : 20;
  }
  private offset(value: unknown) {
    const number = Number(value);
    return Number.isInteger(number) ? Math.max(0, Math.min(9950, number)) : 0;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private bounded(value: string | null, max: number) {
    return value ? value.slice(0, max) : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): JsonObject[] {
    return Array.isArray(value)
      ? value.filter(
          (item): item is JsonObject =>
            !!item && typeof item === "object" && !Array.isArray(item),
        )
      : [];
  }
}
