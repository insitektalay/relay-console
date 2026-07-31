import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export class GoogleTasksApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleTasksApiAdapter {
  private readonly origin = "https://tasks.googleapis.com/tasks/v1";
  async health(token: string) {
    await this.request(token, "GET", `${this.origin}/users/@me/lists`, {
      maxResults: "1",
    });
  }
  async listTaskLists(token: string) {
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/users/@me/lists`,
      { maxResults: "20" },
    );
    const items = this.array(value.items)
      .slice(0, 20)
      .map((v) => this.taskList(v));
    return {
      taskLists: items,
      count: items.length,
      nextPageTokenPresent: Boolean(this.text(value.nextPageToken)),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  async listTasks(token: string, input: JsonObject) {
    const list = this.id(input.taskListId, "taskListId");
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/lists/${list}/tasks`,
      {
        maxResults: "100",
        showCompleted: "true",
        showDeleted: "false",
        showHidden: "false",
      },
    );
    const items = this.array(value.items)
      .slice(0, 100)
      .map((v) => this.task(v));
    return {
      tasks: items,
      count: items.length,
      nextPageTokenPresent: Boolean(this.text(value.nextPageToken)),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  prepareUpdate(input: JsonObject) {
    const operation =
      input.operation === "create" || input.operation === "patch"
        ? input.operation
        : null;
    if (!operation)
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "operation must be create or patch.",
      );
    const change = {
      taskListId: this.id(input.taskListId, "taskListId"),
      ...(operation === "patch"
        ? { taskId: this.id(input.taskId, "taskId") }
        : {}),
      operation,
      fields: this.writeBody(input, operation === "patch"),
    };
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }
  async createTask(token: string, input: JsonObject) {
    const list = this.id(input.taskListId, "taskListId"),
      value = await this.request(
        token,
        "POST",
        `${this.origin}/lists/${list}/tasks`,
        {},
        this.writeBody(input, false),
      );
    return {
      operation: "create_task",
      task: this.task(value),
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }
  async patchTask(token: string, input: JsonObject) {
    const list = this.id(input.taskListId, "taskListId"),
      taskId = this.id(input.taskId, "taskId");
    const existing = await this.request(
      token,
      "GET",
      `${this.origin}/lists/${list}/tasks/${taskId}`,
    );
    if (existing.assignmentInfo)
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "Tasks assigned from Docs or Chat cannot be mutated by Relay V1.",
      );
    const etag = this.etag(input.etag);
    const value = await this.request(
      token,
      "PATCH",
      `${this.origin}/lists/${list}/tasks/${taskId}`,
      {},
      this.writeBody(input, true),
      { "If-Match": etag },
    );
    return {
      operation: "patch_task",
      task: this.task(value),
      assignedTaskPreflight: true,
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 2,
    };
  }
  private writeBody(input: JsonObject, patch: boolean) {
    const body: JsonObject = {};
    const title = this.optionalText(input.title, 1024),
      notes = this.optionalText(input.notes, 8192),
      due = this.due(input.dueDate);
    if (title) body.title = title;
    if (notes) body.notes = notes;
    if (due) body.due = due;
    if (patch && input.status != null) {
      if (input.status !== "needsAction" && input.status !== "completed")
        throw new GoogleTasksApiError(
          "provider_validation_error",
          "status is invalid.",
        );
      body.status = input.status;
    }
    if (!patch && !title)
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "title is required.",
      );
    if (!Object.keys(body).length)
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "Task write requires an allowlisted field.",
      );
    return body;
  }
  private async request(
    token: string,
    method: string,
    base: string,
    query: Record<string, string> = {},
    body?: JsonObject,
    extraHeaders: Record<string, string> = {},
  ) {
    if (!token || token.length > 8000)
      throw new GoogleTasksApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
    const url = new URL(base);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...extraHeaders,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GoogleTasksApiError(
        "provider_unavailable",
        "Google Tasks could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1048576)
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "Google Tasks response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleTasksApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 412
              ? "provider_validation_error"
              : response.status === 429
                ? "provider_rate_limited"
                : response.status >= 500
                  ? "provider_unavailable"
                  : "provider_validation_error",
        response.status === 412
          ? "Google Tasks rejected a stale ETag."
          : "Google Tasks rejected the bounded request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "Google Tasks returned invalid JSON.",
      );
    }
  }
  private taskList(v: unknown) {
    const r = this.object(v);
    return {
      id: this.text(r.id),
      etag: this.text(r.etag),
      title: this.text(r.title),
      updated: this.text(r.updated),
      selfLinkReturned: false,
    };
  }
  private task(v: unknown) {
    const r = this.object(v);
    return {
      id: this.text(r.id),
      etag: this.text(r.etag),
      title: this.text(r.title),
      notes: this.text(r.notes),
      status: this.text(r.status),
      dueDate: this.text(r.due)?.slice(0, 10) ?? null,
      completed: this.text(r.completed),
      hasParent: Boolean(r.parent),
      assigned: Boolean(r.assignmentInfo),
      linksReturned: false,
      assignmentContextReturned: false,
      driveResourceInfoReturned: false,
      spaceInfoReturned: false,
    };
  }
  private object(v: unknown): JsonObject {
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as JsonObject)
      : {};
  }
  private array(v: unknown) {
    return Array.isArray(v) ? v : [];
  }
  private text(v: unknown) {
    return typeof v === "string" && v.length <= 8192 ? v : null;
  }
  private id(v: unknown, field: string) {
    const r = this.text(v);
    if (!r || r.length > 200 || !/^[A-Za-z0-9_:-]+$/.test(r))
      throw new GoogleTasksApiError(
        "provider_validation_error",
        `${field} is invalid.`,
      );
    return r;
  }
  private optionalText(v: unknown, max: number) {
    if (v == null || v === "") return null;
    if (typeof v !== "string" || !v.trim() || v.trim().length > max)
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "Text input is invalid.",
      );
    return v.trim();
  }
  private due(v: unknown) {
    if (v == null || v === "") return null;
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "dueDate must be an ISO date.",
      );
    return `${v}T00:00:00.000Z`;
  }
  private etag(v: unknown) {
    if (typeof v !== "string" || !v || v.length > 512 || /[\r\n]/.test(v))
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "etag is invalid.",
      );
    return v;
  }
  private key(v: unknown) {
    const r = this.text(v);
    if (!r || r.length < 8 || r.length > 200)
      throw new GoogleTasksApiError(
        "provider_validation_error",
        "idempotencyKey is invalid.",
      );
    return r;
  }
}
