import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SlackListsCredentials = { accessToken: string };
export class SlackListsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SlackListsApiAdapter {
  async health(credentials: SlackListsCredentials) {
    const body = await this.request(credentials, "auth.test", {});
    return {
      teamId: this.id(body.team_id, /^[TE][A-Z0-9]{2,31}$/),
      userId: this.id(body.user_id, /^[UW][A-Z0-9]{2,31}$/),
    };
  }
  async listItems(credentials: SlackListsCredentials, input: JsonObject) {
    const listId = this.listId(input.listId),
      limit = this.limit(input.limit);
    const body = await this.request(credentials, "slackLists.items.list", {
      list_id: listId,
      limit,
    });
    const items = this.array(body.items)
      .slice(0, limit)
      .map((value) => this.shapeItem(value));
    return { listId, items, count: items.length, nextCursorUsed: false };
  }
  draftTextItem(input: JsonObject) {
    return {
      listId: this.listId(input.listId),
      columnId: this.columnId(input.columnId),
      text: this.text(input.text, 2000, true),
      providerSideEffect: false,
    };
  }
  async createTodoList(credentials: SlackListsCredentials, input: JsonObject) {
    const name = this.text(input.name, 200, true);
    const body = await this.request(credentials, "slackLists.create", {
      name,
      todo_mode: true,
    });
    return { listId: this.listId(body.list_id), name, todoMode: true };
  }
  async createTextItem(credentials: SlackListsCredentials, input: JsonObject) {
    const draft = this.draftTextItem(input);
    const body = await this.request(credentials, "slackLists.items.create", {
      list_id: draft.listId,
      initial_fields: [
        {
          column_id: draft.columnId,
          rich_text: [
            {
              type: "rich_text",
              elements: [
                {
                  type: "rich_text_section",
                  elements: [{ type: "text", text: draft.text }],
                },
              ],
            },
          ],
        },
      ],
    });
    return this.shapeItem(body.item);
  }
  private shapeItem(value: unknown) {
    const item = this.object(value);
    const fields = this.array(item.fields)
      .slice(0, 50)
      .flatMap((value) => {
        const field = this.object(value),
          key = this.text(field.key, 100, false)?.toLowerCase() ?? "";
        if (
          /(email|phone|user|attachment|message|link|channel|reference)/.test(
            key,
          ) ||
          [
            "email",
            "phone",
            "user",
            "attachment",
            "message",
            "link",
            "channel",
            "reference",
          ].some((name) => field[name] !== undefined)
        )
          return [];
        return [
          {
            columnId: this.optionalId(field.column_id, /^Col[A-Z0-9]{2,31}$/),
            key: this.text(field.key, 100, false),
            text: this.text(field.text, 500, false),
            value:
              typeof field.value === "string"
                ? field.value.slice(0, 500)
                : typeof field.value === "number" ||
                    typeof field.value === "boolean"
                  ? field.value
                  : null,
          },
        ];
      });
    return {
      itemId: this.id(item.id, /^Rec[A-Z0-9]{2,31}$/),
      listId: this.listId(item.list_id),
      dateCreated: this.integer(item.date_created),
      updatedTimestamp: this.text(item.updated_timestamp, 32, false),
      fields,
    };
  }
  private async request(
    credentials: SlackListsCredentials,
    method: string,
    json: JsonObject,
  ) {
    if (!credentials.accessToken)
      throw new SlackListsApiError(
        "credential_missing",
        "Slack Lists token is required.",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(json),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new SlackListsApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Slack Lists request timed out."
          : "Slack Lists request failed.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new SlackListsApiError(
        "provider_validation_error",
        "Slack Lists response exceeds 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const body = this.object(parsed);
    if (!response.ok || body.ok === false) {
      const error = this.text(body.error, 100, false) ?? "unknown_error";
      throw new SlackListsApiError(
        this.safeCode(response.status, error),
        this.safeMessage(error),
        response.status,
      );
    }
    return body;
  }
  private safeCode(
    status: number,
    error: string,
  ): MarketplaceConnectorSafeErrorCode {
    if (
      status === 401 ||
      /^(invalid_auth|not_authed|token_expired|token_revoked)$/.test(error)
    )
      return "credential_missing";
    if (
      status === 403 ||
      /^(missing_scope|no_permission|permission_denied|list_not_found|team_access_not_granted)$/.test(
        error,
      )
    )
      return "insufficient_scope";
    if (status === 429 || error === "ratelimited")
      return "provider_rate_limited";
    if (
      status >= 500 ||
      /^(internal_error|service_unavailable|fatal_error)$/.test(error)
    )
      return "provider_unavailable";
    return "provider_validation_error";
  }
  private safeMessage(error: string) {
    return (
      (
        {
          invalid_auth: "Slack Lists authorization is invalid.",
          not_authed: "Slack Lists authorization is missing.",
          token_expired: "Slack Lists authorization has expired.",
          token_revoked: "Slack Lists authorization was revoked.",
          missing_scope:
            "Slack Lists authorization is missing lists:read or lists:write.",
          list_not_found: "The Slack List is unavailable to this app.",
          ratelimited: "Slack rate limited the Lists request.",
        } as Record<string, string>
      )[error] ?? "Slack rejected the Lists request."
    );
  }
  private listId(value: unknown) {
    return this.id(value, /^F[A-Z0-9]{2,31}$/);
  }
  private columnId(value: unknown) {
    return this.id(value, /^Col[A-Z0-9]{2,31}$/);
  }
  private id(value: unknown, pattern: RegExp) {
    const id = this.text(value, 64, true);
    if (!pattern.test(id))
      throw new SlackListsApiError(
        "provider_validation_error",
        "Slack Lists identifier is invalid.",
      );
    return id;
  }
  private optionalId(value: unknown, pattern: RegExp) {
    const id = this.text(value, 64, false);
    return id && pattern.test(id) ? id : null;
  }
  private text(value: unknown, maximum: number, required: boolean): string {
    const text = typeof value === "string" ? value.trim() : "";
    if (required && !text)
      throw new SlackListsApiError(
        "provider_validation_error",
        "Required Slack Lists text is missing.",
      );
    if (text.length > maximum)
      throw new SlackListsApiError(
        "provider_validation_error",
        `Slack Lists text must be ${maximum} characters or fewer.`,
      );
    return text;
  }
  private limit(value: unknown) {
    const number = Number(value ?? 25);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), 1), 50)
      : 25;
  }
  private integer(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
}
