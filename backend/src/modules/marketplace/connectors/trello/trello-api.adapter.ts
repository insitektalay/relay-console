import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type TrelloCredentials = { apiKey: string; token: string };

export class TrelloApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TrelloApiAdapter {
  private readonly apiOrigin = "https://api.trello.com";

  async requestToken(apiKey: string, apiSecret: string, callbackUrl: string) {
    return this.oauthTokenRequest(
      "https://trello.com/1/OAuthGetRequestToken",
      apiKey,
      apiSecret,
      { oauth_callback: callbackUrl },
    );
  }

  async exchangeAccessToken(
    apiKey: string,
    apiSecret: string,
    requestToken: string,
    requestTokenSecret: string,
    verifier: string,
  ) {
    return this.oauthTokenRequest(
      "https://trello.com/1/OAuthGetAccessToken",
      apiKey,
      apiSecret,
      { oauth_token: requestToken, oauth_verifier: verifier },
      requestTokenSecret,
    );
  }

  authorizationUrl(requestToken: string) {
    const url = new URL("https://trello.com/1/OAuthAuthorizeToken");
    url.searchParams.set("oauth_token", requestToken);
    url.searchParams.set("name", "Relay Console");
    url.searchParams.set("scope", "read,write");
    url.searchParams.set("expiration", "never");
    return url.toString();
  }

  async getIdentity(credentials: TrelloCredentials) {
    const member = this.object(
      await this.request(credentials, "GET", "/1/members/me", {
        fields: "id,username,fullName,url,avatarUrl",
        organizations: "all",
        organization_fields: "id,displayName,name,url",
      }),
    );
    return {
      memberId: this.requiredId(member.id, "member.id"),
      username: this.text(member.username),
      fullName: this.text(member.fullName),
      url: this.trelloUrl(member.url),
      avatarUrl: this.httpsUrl(member.avatarUrl),
      workspaces: this.array(member.organizations)
        .slice(0, 100)
        .map((value) => this.shapeWorkspace(value)),
    };
  }

  async listBoards(credentials: TrelloCredentials, input: JsonObject) {
    const maxResults = this.limit(input.maxResults, 25);
    const boards = this.array(
      await this.request(credentials, "GET", "/1/members/me/boards", {
        filter: "open",
        fields: "id,name,url,closed,idOrganization,dateLastActivity,shortLink",
      }),
    )
      .slice(0, maxResults)
      .map((value) => this.shapeBoard(value));
    return {
      boards,
      count: boards.length,
      resultLimit: maxResults,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async listBoardCards(credentials: TrelloCredentials, input: JsonObject) {
    const boardId = this.requiredId(input.boardId, "boardId");
    const maxResults = this.limit(input.maxResults, 25);
    const cards = this.array(
      await this.request(
        credentials,
        "GET",
        `/1/boards/${encodeURIComponent(boardId)}/cards/open`,
        {
          fields: this.cardFields,
        },
      ),
    )
      .slice(0, maxResults)
      .map((value) => this.shapeCard(value, 1000));
    return {
      boardId,
      cards,
      count: cards.length,
      resultLimit: maxResults,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async getCard(credentials: TrelloCredentials, input: JsonObject) {
    const cardId = this.requiredId(input.cardId, "cardId");
    const maxDescriptionChars =
      input.maxDescriptionChars === undefined
        ? 4000
        : this.limit(input.maxDescriptionChars, 4000);
    const card = this.object(
      await this.request(
        credentials,
        "GET",
        `/1/cards/${encodeURIComponent(cardId)}`,
        {
          fields: this.cardFields,
          board: "true",
          board_fields: "id,name,url",
          list: "true",
          list_fields: "id,name,closed",
          members: "true",
          member_fields: "id,username,fullName",
          actions: "commentCard",
          actions_limit: "10",
          action_fields: "id,date,data",
          action_memberCreator_fields: "id,username,fullName",
        },
      ),
    );
    return {
      card: {
        ...this.shapeCard(card, maxDescriptionChars),
        board: this.shapeNamed(card.board),
        list: this.shapeNamed(card.list),
        members: this.array(card.members)
          .slice(0, 50)
          .map((v) => this.shapeMember(v)),
        comments: this.array(card.actions)
          .slice(0, 10)
          .map((v) => this.shapeComment(v)),
      },
      providerRequestCount: 1,
    };
  }

  async searchCards(credentials: TrelloCredentials, input: JsonObject) {
    const query = this.requiredText(input.query, "query", 200);
    const maxResults = this.limit(input.maxResults, 25);
    const boardId = this.optionalId(input.boardId, "boardId");
    const result = this.object(
      await this.request(credentials, "GET", "/1/search", {
        query,
        modelTypes: "cards",
        cards_limit: String(maxResults),
        card_fields: this.cardFields,
        partial: "false",
        ...(boardId ? { idBoards: boardId } : {}),
      }),
    );
    const cards = this.array(result.cards)
      .slice(0, maxResults)
      .map((value) => this.shapeCard(value, 1000));
    return {
      query,
      boardId,
      cards,
      count: cards.length,
      resultLimit: maxResults,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async createCard(credentials: TrelloCredentials, input: JsonObject) {
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const form: Record<string, string> = {
      idList: this.requiredId(input.listId, "listId"),
      name: this.requiredText(input.name, "name", 512),
    };
    this.addOptionalText(form, "desc", input.description, "description", 16000);
    this.addOptionalText(form, "due", input.due, "due", 40);
    if (typeof input.dueComplete === "boolean")
      form.dueComplete = String(input.dueComplete);
    const members = this.idArray(input.memberIds, "memberIds", 50);
    if (members.length) form.idMembers = members.join(",");
    const labels = this.idArray(input.labelIds, "labelIds", 50);
    if (labels.length) form.idLabels = labels.join(",");
    this.addPosition(form, input.position);
    const result = await this.request(
      credentials,
      "POST",
      "/1/cards",
      {},
      form,
    );
    return {
      card: this.shapeCard(result, 0),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async updateCard(credentials: TrelloCredentials, input: JsonObject) {
    const cardId = this.requiredId(input.cardId, "cardId");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const form: Record<string, string> = {};
    this.addOptionalText(form, "name", input.name, "name", 512);
    this.addOptionalText(
      form,
      "desc",
      input.description,
      "description",
      16000,
      true,
    );
    this.addOptionalText(form, "idList", input.listId, "listId", 100);
    this.addOptionalText(form, "due", input.due, "due", 40, true);
    if (typeof input.closed === "boolean") form.closed = String(input.closed);
    if (typeof input.dueComplete === "boolean")
      form.dueComplete = String(input.dueComplete);
    this.addPosition(form, input.position);
    if (!Object.keys(form).length)
      throw new TrelloApiError(
        "provider_validation_error",
        "At least one card field must be provided",
      );
    const result = await this.request(
      credentials,
      "PUT",
      `/1/cards/${encodeURIComponent(cardId)}`,
      {},
      form,
    );
    return {
      card: this.shapeCard(result, 0),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async addComment(credentials: TrelloCredentials, input: JsonObject) {
    const cardId = this.requiredId(input.cardId, "cardId");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const result = await this.request(
      credentials,
      "POST",
      `/1/cards/${encodeURIComponent(cardId)}/actions/comments`,
      {},
      { text: this.requiredText(input.text, "text", 4000) },
    );
    return {
      comment: this.shapeComment(result),
      cardId,
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async revoke(credentials: TrelloCredentials) {
    try {
      await this.request(
        credentials,
        "DELETE",
        `/1/tokens/${encodeURIComponent(credentials.token)}`,
      );
    } catch (error) {
      if (
        !(error instanceof TrelloApiError) ||
        error.code !== "token_expired"
      ) {
        throw error;
      }
    }
  }

  private async oauthTokenRequest(
    urlValue: string,
    consumerKey: string,
    consumerSecret: string,
    extra: Record<string, string>,
    tokenSecret = "",
  ) {
    const oauth: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: randomBytes(18).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_version: "1.0",
      ...extra,
    };
    const base = `POST&${this.percent(urlValue)}&${this.percent(
      Object.entries(oauth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${this.percent(k)}=${this.percent(v)}`)
        .join("&"),
    )}`;
    oauth.oauth_signature = createHmac(
      "sha1",
      `${this.percent(consumerSecret)}&${this.percent(tokenSecret)}`,
    )
      .update(base)
      .digest("base64");
    let response: Response;
    try {
      response = await safeConnectorFetch(urlValue, {
        method: "POST",
        headers: {
          Authorization: this.oauthHeader(oauth),
          Accept: "application/x-www-form-urlencoded",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new TrelloApiError(
        "provider_unavailable",
        "Trello OAuth request failed",
      );
    }
    const body = await response.text();
    if (!response.ok)
      throw new TrelloApiError(
        response.status === 429
          ? "provider_rate_limited"
          : "provider_validation_error",
        "Trello rejected the OAuth request",
        response.status,
      );
    const params = new URLSearchParams(body);
    const token = params.get("oauth_token")?.trim() ?? "";
    const secret = params.get("oauth_token_secret")?.trim() ?? "";
    if (!token || !secret)
      throw new TrelloApiError(
        "provider_validation_error",
        "Trello OAuth response was incomplete",
      );
    return { token, secret };
  }

  private async request(
    credentials: TrelloCredentials,
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    query: Record<string, string> = {},
    form?: Record<string, string>,
  ) {
    const url = new URL(path, this.apiOrigin);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: this.oauthHeader({
            oauth_consumer_key: credentials.apiKey,
            oauth_token: credentials.token,
          }),
          ...(form
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        ...(form ? { body: new URLSearchParams(form) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new TrelloApiError("provider_unavailable", "Trello request failed");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code: MarketplaceConnectorSafeErrorCode =
        response.status === 429
          ? "provider_rate_limited"
          : response.status === 401
            ? "token_expired"
            : response.status === 403
              ? "scope_not_granted"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error";
      const message =
        response.status === 429
          ? "Trello rate limit reached"
          : response.status === 401
            ? "Trello authorization expired or was revoked"
            : response.status === 403
              ? "Trello did not grant this operation"
              : response.status >= 500
                ? "Trello is temporarily unavailable"
                : "Trello rejected the bounded request";
      throw new TrelloApiError(code, message, response.status);
    }
    return payload;
  }

  private readonly cardFields =
    "id,name,desc,url,shortLink,idBoard,idList,closed,due,dueComplete,dateLastActivity,labels,idMembers,pos";
  private shapeBoard(value: unknown) {
    const v = this.object(value);
    return {
      id: this.requiredId(v.id, "board.id"),
      name: this.text(v.name),
      url: this.trelloUrl(v.url),
      shortLink: this.text(v.shortLink),
      closed: v.closed === true,
      workspaceId: this.text(v.idOrganization),
      lastActivityAt: this.isoDate(v.dateLastActivity),
    };
  }
  private shapeWorkspace(value: unknown) {
    const v = this.object(value);
    return {
      id: this.requiredId(v.id, "workspace.id"),
      name: this.text(v.displayName) ?? this.text(v.name),
      url: this.trelloUrl(v.url),
    };
  }
  private shapeCard(value: unknown, descriptionLimit: number) {
    const v = this.object(value);
    const description = this.text(v.desc) ?? "";
    return {
      id: this.requiredId(v.id, "card.id"),
      name: this.text(v.name),
      descriptionExcerpt: description.slice(0, descriptionLimit),
      descriptionTruncated: description.length > descriptionLimit,
      url: this.trelloUrl(v.url),
      shortLink: this.text(v.shortLink),
      boardId: this.text(v.idBoard),
      listId: this.text(v.idList),
      closed: v.closed === true,
      due: this.isoDate(v.due),
      dueComplete: v.dueComplete === true,
      lastActivityAt: this.isoDate(v.dateLastActivity),
      position: typeof v.pos === "number" ? v.pos : null,
      memberIds: this.stringArray(v.idMembers, 50),
      labels: this.array(v.labels)
        .slice(0, 50)
        .map((label) => {
          const item = this.object(label);
          return {
            id: this.text(item.id),
            name: this.text(item.name),
            color: this.text(item.color),
          };
        }),
    };
  }
  private shapeComment(value: unknown) {
    const v = this.object(value);
    const data = this.object(v.data);
    return {
      id: this.requiredId(v.id, "comment.id"),
      text: this.text(data.text),
      createdAt: this.isoDate(v.date),
      memberCreator: this.shapeMember(v.memberCreator),
    };
  }
  private shapeMember(value: unknown) {
    const v = this.object(value);
    const id = this.text(v.id);
    return id
      ? { id, username: this.text(v.username), fullName: this.text(v.fullName) }
      : null;
  }
  private shapeNamed(value: unknown) {
    const v = this.object(value);
    const id = this.text(v.id);
    return id
      ? {
          id,
          name: this.text(v.name),
          url: this.trelloUrl(v.url),
          closed: v.closed === true,
        }
      : null;
  }
  private oauthHeader(values: Record<string, string>) {
    return `OAuth ${Object.entries(values)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${this.percent(k)}="${this.percent(v)}"`)
      .join(", ")}`;
  }
  private percent(value: string) {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private requiredText(value: unknown, field: string, max: number) {
    const result = this.text(value);
    if (!result || result.length > max)
      throw new TrelloApiError(
        "provider_validation_error",
        `${field} is required and must be at most ${max} characters`,
      );
    return result;
  }
  private requiredId(value: unknown, field: string) {
    return this.requiredText(value, field, 100);
  }
  private optionalId(value: unknown, field: string) {
    return value === undefined ? null : this.requiredId(value, field);
  }
  private limit(value: unknown, maximum: number) {
    const number = value === undefined ? Math.min(25, maximum) : Number(value);
    if (!Number.isInteger(number) || number < 1 || number > maximum)
      throw new TrelloApiError(
        "provider_validation_error",
        `limit must be between one and ${maximum}`,
      );
    return number;
  }
  private idArray(value: unknown, field: string, maximum: number) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > maximum)
      throw new TrelloApiError(
        "provider_validation_error",
        `${field} must contain at most ${maximum} IDs`,
      );
    return value.map((item) => this.requiredId(item, field));
  }
  private stringArray(value: unknown, maximum: number) {
    return this.array(value)
      .slice(0, maximum)
      .map((item) => this.text(item))
      .filter((item): item is string => Boolean(item));
  }
  private addOptionalText(
    form: Record<string, string>,
    key: string,
    value: unknown,
    field: string,
    max: number,
    allowEmpty = false,
  ) {
    if (value === undefined) return;
    if (allowEmpty && value === "") {
      form[key] = "";
      return;
    }
    form[key] = this.requiredText(value, field, max);
  }
  private addPosition(form: Record<string, string>, value: unknown) {
    if (value === undefined) return;
    if (value === "top" || value === "bottom") {
      form.pos = value;
      return;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0)
      throw new TrelloApiError(
        "provider_validation_error",
        "position must be top, bottom, or a non-negative number",
      );
    form.pos = String(number);
  }
  private idempotencyKey(value: unknown) {
    const key = this.requiredText(value, "idempotencyKey", 128);
    if (key.length < 8)
      throw new TrelloApiError(
        "provider_validation_error",
        "idempotencyKey must be at least eight characters",
      );
    return key;
  }
  private httpsUrl(value: unknown) {
    const raw = this.text(value);
    if (!raw) return null;
    try {
      const url = new URL(raw);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  private trelloUrl(value: unknown) {
    const raw = this.httpsUrl(value);
    if (!raw) return null;
    const url = new URL(raw);
    return url.hostname === "trello.com" || url.hostname.endsWith(".trello.com")
      ? url.toString()
      : null;
  }
  private isoDate(value: unknown) {
    const raw = this.text(value);
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}
