import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class TwistApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) { super(message); }
}

@Injectable()
export class TwistApiAdapter {
  private readonly baseUrl = "https://api.twist.com/api/v3";

  async getUser(accessToken: string) {
    return this.shapeUser(await this.request(accessToken, "/users/get_session_user"));
  }

  async listWorkspaces(accessToken: string, limitInput: unknown = 20) {
    const values = this.array(await this.request(accessToken, "/workspaces/get"));
    return values.slice(0, this.limit(limitInput, 20)).map((value) => this.shapeWorkspace(value));
  }

  async listChannels(accessToken: string, workspaceIdInput: unknown, limitInput: unknown = 50) {
    const workspaceId = this.numericId(workspaceIdInput, "workspaceId");
    const values = this.array(await this.request(accessToken, "/channels/get", { workspace_id: workspaceId }));
    return values.slice(0, this.limit(limitInput, 50)).map((value) => this.shapeChannel(value));
  }

  async listInboxThreads(accessToken: string, workspaceIdInput: unknown, limitInput: unknown = 20) {
    const workspaceId = this.numericId(workspaceIdInput, "workspaceId");
    const limit = this.limit(limitInput, 20);
    const values = this.array(await this.request(accessToken, "/inbox/get", {
      workspace_id: workspaceId, limit: String(limit), order_by: "desc", archive_filter: "active",
    }));
    return values.slice(0, limit).map((value) => this.shapeThread(value));
  }

  async getThreadWithComments(accessToken: string, threadIdInput: unknown, commentLimitInput: unknown = 30) {
    const threadId = this.numericId(threadIdInput, "threadId");
    const limit = this.limit(commentLimitInput, 30);
    const [threadValue, commentValues] = await Promise.all([
      this.request(accessToken, "/threads/getone", { id: threadId }),
      this.request(accessToken, "/comments/get", { thread_id: threadId }),
    ]);
    const comments = this.array(commentValues).slice(-limit).map((value) => this.shapeComment(value));
    return { thread: this.shapeThread(threadValue), comments, commentCount: comments.length };
  }

  private async request(accessToken: string, path: string, query: Record<string, string> = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new TwistApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Twist request timed out" : "Twist request failed",
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok) {
      throw new TwistApiError(this.errorCode(response.status), `Twist request failed with ${response.status}`, response.status);
    }
    return body;
  }

  private shapeUser(value: unknown) {
    const user = this.object(value);
    const userId = this.identifier(user.id);
    const name = this.string(user.name);
    if (!userId || !name) throw new TwistApiError("provider_validation_error", "Twist user is incomplete");
    return { userId, name, email: this.string(user.email), timezone: this.string(user.timezone) };
  }

  private shapeWorkspace(value: unknown) {
    const workspace = this.object(value);
    const workspaceId = this.identifier(workspace.id);
    const name = this.string(workspace.name);
    if (!workspaceId || !name) throw new TwistApiError("provider_validation_error", "Twist workspace is incomplete");
    return { workspaceId, name };
  }

  private shapeChannel(value: unknown) {
    const channel = this.object(value);
    const channelId = this.identifier(channel.id);
    const workspaceId = this.identifier(channel.workspace_id);
    const name = this.string(channel.name);
    if (!channelId || !workspaceId || !name) throw new TwistApiError("provider_validation_error", "Twist channel is incomplete");
    return { channelId, workspaceId, name, description: this.text(channel.description, 1000), archived: channel.archived === true };
  }

  private shapeThread(value: unknown) {
    const thread = this.object(value);
    const threadId = this.identifier(thread.id);
    const workspaceId = this.identifier(thread.workspace_id);
    const channelId = this.identifier(thread.channel_id);
    const title = this.string(thread.title);
    if (!threadId || !workspaceId || !channelId || !title) throw new TwistApiError("provider_validation_error", "Twist thread is incomplete");
    return {
      threadId, workspaceId, channelId, title,
      content: this.text(thread.content, 6000), snippet: this.text(thread.snippet, 1000),
      creatorId: this.identifier(thread.creator), commentCount: this.integer(thread.comment_count),
      postedAt: this.integer(thread.posted_ts), lastUpdatedAt: this.integer(thread.last_updated_ts),
      archived: thread.is_archived === true, pinned: thread.pinned === true,
    };
  }

  private shapeComment(value: unknown) {
    const comment = this.object(value);
    const commentId = this.identifier(comment.id);
    const threadId = this.identifier(comment.thread_id);
    const content = this.text(comment.content, 4000);
    if (!commentId || !threadId || !content) throw new TwistApiError("provider_validation_error", "Twist comment is incomplete");
    return {
      commentId, threadId, content, creatorId: this.identifier(comment.creator),
      postedAt: this.integer(comment.posted_ts), lastEditedAt: this.integer(comment.last_edited_ts),
    };
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
  }
  private array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
  private string(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
  private text(value: unknown, max: number) { const text = this.string(value); return text ? text.slice(0, max) : null; }
  private integer(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) ? value : null; }
  private identifier(value: unknown) {
    const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : this.string(value);
    return text && /^[0-9]+$/.test(text) && text.length <= 64 ? text : null;
  }
  private numericId(value: unknown, field: string) {
    const id = this.identifier(value);
    if (!id) throw new TwistApiError("provider_validation_error", `${field} must be a numeric Twist ID`);
    return id;
  }
  private limit(value: unknown, maximum: number) {
    const number = typeof value === "number" ? value : Number(value ?? maximum);
    if (!Number.isFinite(number)) return maximum;
    return Math.max(1, Math.min(maximum, Math.trunc(number)));
  }
  private async safeBody(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text) as unknown; } catch { return {}; }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    return "provider_unavailable";
  }
}
