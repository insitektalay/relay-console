import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class SlackApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SlackApiAdapter {
  private readonly baseUrl = "https://slack.com/api";

  async authTest(accessToken: string) {
    const body = this.object(await this.request(accessToken, "auth.test", {}));
    const teamId = this.id(body.team_id);
    const userId = this.id(body.user_id);
    if (!teamId || !userId) {
      throw new SlackApiError(
        "provider_validation_error",
        "Slack authorization identity is incomplete",
      );
    }
    return {
      teamId,
      teamName: this.string(body.team),
      userId,
      userName: this.string(body.user),
      botId: this.id(body.bot_id),
      enterpriseId: this.id(body.enterprise_id),
      workspaceUrl: this.httpsUrl(body.url),
    };
  }

  async listPublicChannels(
    accessToken: string,
    queryInput: unknown,
    limitInput: unknown = 50,
  ) {
    const limit = this.limit(limitInput, 50);
    const query = this.string(queryInput)?.toLowerCase() ?? "";
    const body = this.object(
      await this.request(accessToken, "conversations.list", {
        types: "public_channel",
        exclude_archived: "true",
        limit: String(limit),
      }),
    );
    const channels = this.array(body.channels)
      .map((value) => this.shapeChannel(value))
      .filter((value) => !query || value.name.toLowerCase().includes(query))
      .slice(0, limit);
    return { channels, count: channels.length, nextCursorUsed: false };
  }

  async readConversation(
    accessToken: string,
    channelIdInput: unknown,
    threadTsInput: unknown,
    limitInput: unknown = 50,
  ) {
    const channelId = this.channelId(channelIdInput);
    const threadTs = this.optionalTimestamp(threadTsInput);
    const limit = this.limit(limitInput, 50);
    const method = threadTs ? "conversations.replies" : "conversations.history";
    const body = this.object(
      await this.request(accessToken, method, {
        channel: channelId,
        limit: String(limit),
        ...(threadTs ? { ts: threadTs } : {}),
      }),
    );
    const messages = this.array(body.messages)
      .slice(0, limit)
      .map((value) => this.shapeMessage(value, channelId));
    return {
      channelId,
      threadTs,
      messages,
      count: messages.length,
      nextCursorUsed: false,
    };
  }

  async postMessage(
    accessToken: string,
    input: {
      channelId: unknown;
      text: unknown;
      threadTs?: unknown;
      idempotencyKey: unknown;
    },
  ) {
    const channelId = this.channelId(input.channelId);
    const text = this.messageText(input.text);
    const threadTs = this.optionalTimestamp(input.threadTs);
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const body = this.object(
      await this.request(
        accessToken,
        "chat.postMessage",
        {},
        {
          channel: channelId,
          text,
          client_msg_id: idempotencyKey,
          unfurl_links: false,
          unfurl_media: false,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        },
      ),
    );
    const message = this.object(body.message);
    const timestamp = this.timestamp(body.ts) ?? this.timestamp(message.ts);
    if (!timestamp) {
      throw new SlackApiError(
        "provider_validation_error",
        "Slack send response is incomplete",
      );
    }
    return {
      channelId: this.id(body.channel) ?? channelId,
      timestamp,
      threadTs: this.timestamp(message.thread_ts) ?? threadTs,
      textExcerpt: text.slice(0, 500),
      idempotencyKey,
    };
  }

  private async request(
    accessToken: string,
    method: string,
    query: Record<string, string>,
    jsonBody?: JsonObject,
  ) {
    const url = new URL(`${this.baseUrl}/${method}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: jsonBody ? "POST" : "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(jsonBody
            ? { "Content-Type": "application/json; charset=utf-8" }
            : {}),
        },
        body: jsonBody ? JSON.stringify(jsonBody) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new SlackApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Slack request timed out"
          : "Slack request failed",
      );
    }
    const body = this.object(await this.safeBody(response));
    if (!response.ok || body.ok === false) {
      const providerError = this.string(body.error) ?? "unknown_error";
      throw new SlackApiError(
        this.errorCode(response.status, providerError),
        this.safeErrorMessage(providerError),
        response.status,
      );
    }
    return body;
  }

  private shapeChannel(value: unknown) {
    const channel = this.object(value);
    const channelId = this.channelId(channel.id);
    const name = this.string(channel.name);
    if (!name)
      throw new SlackApiError(
        "provider_validation_error",
        "Slack channel is incomplete",
      );
    const topic = this.object(channel.topic);
    const purpose = this.object(channel.purpose);
    return {
      channelId,
      name,
      isMember: channel.is_member === true,
      isShared: channel.is_shared === true,
      isExternalShared: channel.is_ext_shared === true,
      topic: this.text(topic.value, 500),
      purpose: this.text(purpose.value, 500),
    };
  }

  private shapeMessage(value: unknown, channelId: string) {
    const message = this.object(value);
    const timestamp = this.timestamp(message.ts);
    const text = this.text(message.text, 4000);
    if (!timestamp || text === null) {
      throw new SlackApiError(
        "provider_validation_error",
        "Slack message is incomplete",
      );
    }
    return {
      channelId,
      timestamp,
      threadTs: this.timestamp(message.thread_ts),
      senderId: this.id(message.user) ?? this.id(message.bot_id),
      text,
      replyCount: this.integer(message.reply_count),
      messageType: this.string(message.subtype) ?? "message",
    };
  }

  private messageText(value: unknown) {
    const text = this.string(value);
    if (!text)
      throw new SlackApiError("provider_validation_error", "text is required");
    if (text.length > 4000)
      throw new SlackApiError(
        "provider_validation_error",
        "text must be 4000 characters or fewer",
      );
    if (/<!?(channel|everyone|here)>/i.test(text)) {
      throw new SlackApiError(
        "policy_blocked",
        "Channel-wide Slack mentions are blocked",
      );
    }
    return text;
  }

  private channelId(value: unknown) {
    const id = this.id(value);
    if (!id || !/^[A-Z0-9]{2,32}$/.test(id)) {
      throw new SlackApiError(
        "provider_validation_error",
        "channelId must be a Slack channel ID",
      );
    }
    return id;
  }

  private idempotencyKey(value: unknown) {
    const key = this.string(value);
    if (!key || !/^[A-Za-z0-9_-]{8,64}$/.test(key)) {
      throw new SlackApiError(
        "provider_validation_error",
        "idempotencyKey must be 8 to 64 URL-safe characters",
      );
    }
    return key;
  }

  private optionalTimestamp(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    const timestamp = this.timestamp(value);
    if (!timestamp)
      throw new SlackApiError(
        "provider_validation_error",
        "threadTs must be a Slack timestamp",
      );
    return timestamp;
  }

  private timestamp(value: unknown) {
    const text = this.string(value);
    return text && /^[0-9]{1,16}\.[0-9]{1,16}$/.test(text) ? text : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private text(value: unknown, maximum: number) {
    const text = this.string(value);
    return text === null ? null : text.slice(0, maximum);
  }

  private id(value: unknown) {
    const text = this.string(value);
    return text && /^[A-Za-z0-9_-]{2,64}$/.test(text) ? text : null;
  }

  private integer(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
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

  private limit(value: unknown, maximum: number) {
    const number = typeof value === "number" ? value : Number(value ?? maximum);
    if (!Number.isFinite(number)) return maximum;
    return Math.max(1, Math.min(maximum, Math.trunc(number)));
  }

  private async safeBody(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {};
    }
  }

  private errorCode(
    status: number,
    providerError: string,
  ): MarketplaceConnectorSafeErrorCode {
    if (status === 429 || providerError === "ratelimited")
      return "provider_rate_limited";
    if (
      [
        "invalid_auth",
        "token_revoked",
        "account_inactive",
        "not_authed",
      ].includes(providerError)
    ) {
      return "token_expired";
    }
    if (providerError === "missing_scope") return "insufficient_scope";
    if (
      ["channel_not_found", "not_in_channel", "is_archived"].includes(
        providerError,
      )
    ) {
      return "provider_validation_error";
    }
    if (status >= 500 || providerError === "fatal_error")
      return "provider_unavailable";
    return "provider_validation_error";
  }

  private safeErrorMessage(providerError: string) {
    const known: Record<string, string> = {
      invalid_auth: "Slack authorization is invalid",
      token_revoked: "Slack authorization was revoked",
      account_inactive: "Slack account is inactive",
      not_authed: "Slack authorization is missing",
      missing_scope: "Slack authorization is missing a required scope",
      channel_not_found: "Slack channel was not found",
      not_in_channel: "Relay Console is not a member of that Slack channel",
      is_archived: "Slack channel is archived",
      ratelimited: "Slack rate limit reached",
    };
    return known[providerError] ?? "Slack request was rejected";
  }
}
