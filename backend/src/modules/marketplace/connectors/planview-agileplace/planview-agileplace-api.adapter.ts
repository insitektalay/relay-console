import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type PlanviewAgilePlaceCredentials = {
  apiToken: string;
  accountHostname: string;
};

export class PlanviewAgilePlaceApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PlanviewAgilePlaceApiAdapter {
  async health(credentials: PlanviewAgilePlaceCredentials) {
    const result = await this.listBoards(credentials, { limit: 1 });
    return {
      accountHostname: this.hostname(credentials.accountHostname),
      boardCount: result.count,
    };
  }

  async listBoards(
    credentials: PlanviewAgilePlaceCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      only: "id,title,description,version,isArchived,accessLevel",
    });
    if (input.keyword !== undefined)
      query.set("search", this.text(input.keyword, "keyword", 1, 80));
    const parsed = await this.request(
      credentials,
      `/io/board?${query.toString()}`,
      "GET",
    );
    const source = this.collection(parsed, "boards");
    const rows = source.slice(0, limit).map((value) => this.board(value));
    return { rows, count: rows.length, truncated: source.length > limit };
  }

  async getBoard(
    credentials: PlanviewAgilePlaceCredentials,
    input: JsonObject,
  ) {
    const boardId = this.id(input.boardId, "board");
    return this.board(
      await this.request(credentials, `/io/board/${boardId}`, "GET"),
    );
  }

  async listCards(
    credentials: PlanviewAgilePlaceCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const boardId = this.id(input.boardId, "board");
    const query = new URLSearchParams({
      board: boardId,
      offset: "0",
      limit: String(limit),
      select: "cards",
      only:
        "id,title,version,priority,size,plannedStart,plannedFinish,actualStart,actualFinish,createdOn,updatedOn,blockedStatus,board,lane,type",
      sort: "activity",
      sortDirection: "DESC",
    });
    if (input.keyword !== undefined)
      query.set("search", this.text(input.keyword, "keyword", 1, 80));
    const parsed = await this.request(
      credentials,
      `/io/card?${query.toString()}`,
      "GET",
    );
    const source = this.collection(parsed, "cards");
    const rows = source.slice(0, limit).map((value) => this.card(value));
    return {
      rows,
      count: rows.length,
      truncated: this.total(parsed) > rows.length,
    };
  }

  async getCard(
    credentials: PlanviewAgilePlaceCredentials,
    input: JsonObject,
  ) {
    const cardId = this.id(input.cardId, "card");
    return this.card(
      await this.request(
        credentials,
        `/io/card/${cardId}?excludeComments=true`,
        "GET",
      ),
    );
  }

  async createCard(
    credentials: PlanviewAgilePlaceCredentials,
    input: JsonObject,
  ) {
    const boardId = this.id(input.boardId, "board");
    return this.card(
      await this.request(credentials, "/io/card?returnFullRecord=true", "POST", {
        destination: { boardId },
        title: this.text(input.title, "title", 1, 200),
      }),
    );
  }

  async updateCard(
    credentials: PlanviewAgilePlaceCredentials,
    input: JsonObject,
  ) {
    const cardId = this.id(input.cardId, "card");
    const expectedTitle = this.text(
      input.expectedTitle,
      "expected title",
      1,
      200,
    );
    const expectedVersion = this.id(input.expectedVersion, "card version");
    const current = await this.getCard(credentials, { cardId });
    if (
      current.title !== expectedTitle ||
      current.version !== expectedVersion
    )
      throw new PlanviewAgilePlaceApiError(
        "provider_validation_error",
        "Planview AgilePlace card changed before update.",
        409,
      );
    const operations: JsonObject[] = [
      { op: "test", path: "/version", value: expectedVersion },
      {
        op: "replace",
        path: "/title",
        value: this.text(input.title, "title", 1, 200),
      },
    ];
    return this.card(
      await this.request(
        credentials,
        `/io/card/${cardId}`,
        "PATCH",
        operations,
      ),
    );
  }

  async deleteCard(
    credentials: PlanviewAgilePlaceCredentials,
    input: JsonObject,
  ) {
    const cardId = this.id(input.cardId, "card");
    const expectedTitle = this.text(
      input.expectedTitle,
      "expected title",
      1,
      200,
    );
    const expectedVersion = this.id(input.expectedVersion, "card version");
    const current = await this.getCard(credentials, { cardId });
    if (
      current.title !== expectedTitle ||
      current.version !== expectedVersion
    )
      throw new PlanviewAgilePlaceApiError(
        "provider_validation_error",
        "Planview AgilePlace card changed before deletion.",
        409,
      );
    await this.request(credentials, `/io/card/${cardId}`, "DELETE", undefined, {
      "x-lk-resource-version": expectedVersion,
    });
    return { deleted: true, cardId };
  }

  private async request(
    credentials: PlanviewAgilePlaceCredentials,
    path: string,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ) {
    const token = credentials.apiToken.trim();
    if (!token || token.length > 2_048)
      throw new PlanviewAgilePlaceApiError(
        "connection_not_ready",
        "Planview AgilePlace API token is required.",
      );
    const hostname = this.hostname(credentials.accountHostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await safeConnectorFetch(`https://${hostname}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...extraHeaders,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      const raw = await this.readBounded(response);
      let parsed: unknown = {};
      if (raw.trim()) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new PlanviewAgilePlaceApiError(
            "provider_unavailable",
            "Planview AgilePlace returned invalid JSON.",
            response.status,
          );
        }
      }
      if (!response.ok)
        throw new PlanviewAgilePlaceApiError(
          this.errorCode(response.status),
          this.errorMessage(response.status),
          response.status,
        );
      return parsed;
    } catch (error) {
      if (error instanceof PlanviewAgilePlaceApiError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new PlanviewAgilePlaceApiError(
          "provider_unavailable",
          "Planview AgilePlace request timed out.",
        );
      throw new PlanviewAgilePlaceApiError(
        "provider_unavailable",
        "Planview AgilePlace request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readBounded(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > 262_144)
      throw new PlanviewAgilePlaceApiError(
        "provider_unavailable",
        "Planview AgilePlace response exceeded 256 KiB.",
        response.status,
      );
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 262_144)
      throw new PlanviewAgilePlaceApiError(
        "provider_unavailable",
        "Planview AgilePlace response exceeded 256 KiB.",
        response.status,
      );
    return text;
  }

  private hostname(value: unknown) {
    if (typeof value !== "string") throw this.validation("Account hostname is required.");
    const hostname = value.trim().toLowerCase();
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.leankit\.com$/.test(
        hostname,
      )
    )
      throw this.validation(
        "Planview AgilePlace account hostname must be one tenant under leankit.com.",
      );
    return hostname;
  }

  private collection(value: unknown, key: string): unknown[] {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    const object = value as JsonObject;
    return Array.isArray(object[key]) ? object[key] : [];
  }

  private total(value: unknown) {
    if (!value || typeof value !== "object") return 0;
    const pageMeta = (value as JsonObject).pageMeta;
    if (!pageMeta || typeof pageMeta !== "object") return 0;
    const total = Number((pageMeta as JsonObject).totalRecords);
    return Number.isFinite(total) ? total : 0;
  }

  private board(value: unknown) {
    const object = this.object(value);
    return {
      id: this.clean(object.id, 64),
      title: this.clean(object.title, 200),
      version: this.clean(object.version, 64),
      isArchived: Boolean(object.isArchived),
      accessLevel: this.clean(object.accessLevel, 64),
    };
  }

  private card(value: unknown) {
    const object = this.object(value);
    const board = this.object(object.board, true);
    const lane = this.object(object.lane, true);
    const type = this.object(object.type, true);
    const blocked = this.object(object.blockedStatus, true);
    return {
      id: this.clean(object.id, 64),
      title: this.clean(object.title, 200),
      version: this.clean(object.version, 64),
      priority: this.clean(object.priority, 32),
      size: typeof object.size === "number" ? object.size : null,
      plannedStart: this.clean(object.plannedStart, 40),
      plannedFinish: this.clean(object.plannedFinish, 40),
      actualStart: this.clean(object.actualStart, 40),
      actualFinish: this.clean(object.actualFinish, 40),
      createdOn: this.clean(object.createdOn, 40),
      updatedOn: this.clean(object.updatedOn, 40),
      isBlocked: Boolean(blocked.isBlocked),
      board: { id: this.clean(board.id, 64), title: this.clean(board.title, 200) },
      lane: { id: this.clean(lane.id, 64), title: this.clean(lane.title, 200) },
      type: { id: this.clean(type.id, 64), title: this.clean(type.title, 200) },
    };
  }

  private object(value: unknown, optional = false): JsonObject {
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as JsonObject;
    if (optional) return {};
    throw this.validation("Planview AgilePlace returned an invalid record.");
  }

  private clean(value: unknown, max: number) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).slice(0, max)
      : null;
  }

  private id(value: unknown, label: string) {
    if (typeof value !== "string" || !/^\d{1,20}$/.test(value))
      throw this.validation(`Planview AgilePlace ${label} ID is invalid.`);
    return value;
  }

  private text(value: unknown, label: string, min: number, max: number) {
    if (typeof value !== "string")
      throw this.validation(`Planview AgilePlace ${label} is required.`);
    const text = value.trim();
    if (text.length < min || text.length > max)
      throw this.validation(`Planview AgilePlace ${label} is invalid.`);
    return text;
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20)
      throw this.validation("Planview AgilePlace limit must be from 1 to 20.");
    return Number(value);
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 409 || status === 412 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(status: number) {
    if (status === 401) return "Planview AgilePlace rejected the API token.";
    if (status === 403)
      return "Planview AgilePlace denied this action for the token user.";
    if (status === 404) return "Planview AgilePlace resource was not found.";
    if (status === 429) return "Planview AgilePlace rate limited the request.";
    if (status >= 500) return "Planview AgilePlace is unavailable.";
    return "Planview AgilePlace rejected the fixed request.";
  }

  private validation(message: string) {
    return new PlanviewAgilePlaceApiError("provider_validation_error", message);
  }
}
