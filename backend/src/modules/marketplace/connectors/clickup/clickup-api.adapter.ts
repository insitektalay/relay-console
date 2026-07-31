import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class ClickUpApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ClickUpApiAdapter {
  private readonly origin = "https://api.clickup.com";

  async getIdentity(accessToken: string) {
    const [user, workspaceEnvelope] = await Promise.all([
      this.request(accessToken, "GET", "/api/v2/user"),
      this.request(accessToken, "GET", "/api/v2/team"),
    ]);
    const profile = this.object(user.user);
    const workspaces = this.array(workspaceEnvelope.teams)
      .slice(0, 100)
      .map((value) => this.shapeWorkspace(value));
    return {
      userId: this.requiredId(profile.id, "user.id"),
      username: this.text(profile.username),
      email: this.text(profile.email),
      workspaces,
      providerRequestCount: 2,
    };
  }

  async listWorkspaces(accessToken: string, input: JsonObject) {
    const maxResults = this.limit(input.maxResults, 25, 25);
    const envelope = await this.request(accessToken, "GET", "/api/v2/team");
    const workspaces = this.array(envelope.teams)
      .slice(0, maxResults)
      .map((value) => this.shapeWorkspace(value));
    return { workspaces, count: workspaces.length, providerRequestCount: 1 };
  }

  async searchWorkspaceTasks(accessToken: string, input: JsonObject) {
    const workspaceId = this.requiredId(input.workspaceId, "workspaceId");
    const maxResults = this.limit(input.maxResults, 20, 50);
    const queryText = this.optionalText(
      input.query,
      "query",
      200,
    )?.toLowerCase();
    const envelope = await this.request(
      accessToken,
      "GET",
      `/api/v2/team/${encodeURIComponent(workspaceId)}/task`,
      { page: "0", include_closed: "true", subtasks: "true" },
    );
    const visible = this.array(envelope.tasks).filter((value) => {
      if (!queryText) return true;
      const task = this.object(value);
      return [task.name, task.text_content, task.description, task.custom_id]
        .map((field) => this.text(field)?.toLowerCase() ?? "")
        .some((field) => field.includes(queryText));
    });
    const tasks = visible
      .slice(0, maxResults)
      .map((value) => this.shapeTask(value, 1000));
    return {
      workspaceId,
      query: queryText ?? null,
      tasks,
      count: tasks.length,
      searchedProviderPage: 0,
      providerPageLimit: 100,
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async listTasks(accessToken: string, input: JsonObject) {
    const listId = this.requiredId(input.listId, "listId");
    const maxResults = this.limit(input.maxResults, 20, 50);
    const envelope = await this.request(
      accessToken,
      "GET",
      `/api/v2/list/${encodeURIComponent(listId)}/task`,
      { page: "0", include_closed: "true", subtasks: "true" },
    );
    const tasks = this.array(envelope.tasks)
      .slice(0, maxResults)
      .map((value) => this.shapeTask(value, 1000));
    return {
      listId,
      tasks,
      count: tasks.length,
      providerPageLimit: 100,
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async getTask(accessToken: string, input: JsonObject) {
    const taskId = this.requiredId(input.taskId, "taskId");
    const maxDescriptionChars = this.limit(
      input.maxDescriptionChars,
      4000,
      4000,
    );
    const task = await this.request(
      accessToken,
      "GET",
      `/api/v2/task/${encodeURIComponent(taskId)}`,
      { include_subtasks: "false" },
    );
    return {
      task: this.shapeTask(task, maxDescriptionChars),
      providerRequestCount: 1,
    };
  }

  async createTask(accessToken: string, input: JsonObject) {
    const listId = this.requiredId(input.listId, "listId");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const task = await this.request(
      accessToken,
      "POST",
      `/api/v2/list/${encodeURIComponent(listId)}/task`,
      {},
      this.createFields(input),
    );
    return {
      task: this.shapeTask(task, 0),
      listId,
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async updateTask(accessToken: string, input: JsonObject) {
    const taskId = this.requiredId(input.taskId, "taskId");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const body = this.updateFields(input);
    if (!Object.keys(body).length)
      throw new ClickUpApiError(
        "provider_validation_error",
        "At least one task field must be provided",
      );
    const task = await this.request(
      accessToken,
      "PUT",
      `/api/v2/task/${encodeURIComponent(taskId)}`,
      {},
      body,
    );
    return {
      task: this.shapeTask(task, 0),
      taskId,
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async addComment(accessToken: string, input: JsonObject) {
    const taskId = this.requiredId(input.taskId, "taskId");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const response = await this.request(
      accessToken,
      "POST",
      `/api/v2/task/${encodeURIComponent(taskId)}/comment`,
      {},
      {
        comment_text: this.requiredText(input.comment, "comment", 8000),
        notify_all: false,
      },
    );
    return {
      commentId: this.text(response.id),
      taskId,
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  private async request(
    accessToken: string,
    method: "GET" | "POST" | "PUT",
    path: string,
    query: Record<string, string> = {},
    body?: JsonObject,
  ) {
    const url = new URL(path, this.origin);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new ClickUpApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "ClickUp request timed out"
          : "ClickUp request failed",
      );
    }
    const envelope = this.object(await response.json().catch(() => ({})));
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
        response.status === 401
          ? "ClickUp authorization is no longer valid"
          : response.status === 403
            ? "ClickUp did not authorize this Workspace operation"
            : response.status === 429
              ? "ClickUp rate limit reached"
              : response.status >= 500
                ? "ClickUp is temporarily unavailable"
                : "ClickUp rejected the bounded request";
      throw new ClickUpApiError(code, message, response.status);
    }
    return envelope;
  }

  private createFields(input: JsonObject) {
    const body: JsonObject = {
      name: this.requiredText(input.name, "name", 512),
      notify_all: false,
    };
    this.assignText(body, "description", input.description, 16000);
    this.assignText(body, "status", input.status, 100);
    this.assignInteger(body, "priority", input.priority, 1, 4);
    this.assignInteger(
      body,
      "due_date",
      input.dueDate,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    this.assignInteger(
      body,
      "start_date",
      input.startDate,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const assignees = this.integerArray(input.assigneeIds, "assigneeIds", 25);
    if (assignees) body.assignees = assignees;
    const parent = this.optionalId(input.parentTaskId, "parentTaskId");
    if (parent) body.parent = parent;
    return body;
  }

  private updateFields(input: JsonObject) {
    const body: JsonObject = {};
    this.assignText(body, "name", input.name, 512);
    this.assignText(body, "description", input.description, 16000, true);
    this.assignText(body, "status", input.status, 100);
    this.assignInteger(body, "priority", input.priority, 1, 4);
    this.assignInteger(
      body,
      "due_date",
      input.dueDate,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    this.assignInteger(
      body,
      "start_date",
      input.startDate,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const add = this.integerArray(input.addAssigneeIds, "addAssigneeIds", 25);
    const rem = this.integerArray(
      input.removeAssigneeIds,
      "removeAssigneeIds",
      25,
    );
    if (add || rem) body.assignees = { add: add ?? [], rem: rem ?? [] };
    return body;
  }

  private shapeWorkspace(value: unknown) {
    const workspace = this.object(value);
    return {
      id: this.requiredId(workspace.id, "workspace.id"),
      name: this.text(workspace.name),
      color: this.text(workspace.color),
      memberCount: this.array(workspace.members).length,
    };
  }

  private shapeTask(value: unknown, descriptionLimit: number) {
    const task = this.object(value);
    const description =
      this.text(task.text_content) ?? this.text(task.description) ?? "";
    const status = this.object(task.status);
    const priority = this.object(task.priority);
    const list = this.object(task.list);
    const folder = this.object(task.folder);
    const space = this.object(task.space);
    return {
      id: this.requiredId(task.id, "task.id"),
      customId: this.text(task.custom_id),
      name: this.text(task.name),
      descriptionExcerpt: descriptionLimit
        ? description.slice(0, descriptionLimit)
        : "",
      descriptionTruncated:
        descriptionLimit > 0 && description.length > descriptionLimit,
      status: this.text(status.status),
      priority: this.text(priority.priority),
      assignees: this.array(task.assignees)
        .slice(0, 25)
        .map((value) => {
          const user = this.object(value);
          return { id: this.text(user.id), username: this.text(user.username) };
        }),
      dueDate: this.text(task.due_date),
      startDate: this.text(task.start_date),
      list: { id: this.text(list.id), name: this.text(list.name) },
      folder: { id: this.text(folder.id), name: this.text(folder.name) },
      space: { id: this.text(space.id), name: this.text(space.name) },
      url: this.safeUrl(task.url),
      updatedAt: this.text(task.date_updated),
      parentTaskId: this.text(task.parent),
    };
  }

  private assignText(
    body: JsonObject,
    key: string,
    value: unknown,
    max: number,
    allowEmpty = false,
  ) {
    if (value === undefined) return;
    const text = allowEmpty
      ? this.text(value)
      : this.optionalText(value, key, max);
    if (typeof text !== "string" || text.length > max)
      throw new ClickUpApiError(
        "provider_validation_error",
        `${key} is invalid`,
      );
    body[key] = text;
  }

  private assignInteger(
    body: JsonObject,
    key: string,
    value: unknown,
    min: number,
    max: number,
  ) {
    if (value === undefined) return;
    if (
      !Number.isSafeInteger(value) ||
      (value as number) < min ||
      (value as number) > max
    )
      throw new ClickUpApiError(
        "provider_validation_error",
        `${key} is invalid`,
      );
    body[key] = value;
  }

  private integerArray(value: unknown, field: string, maxItems: number) {
    if (value === undefined) return null;
    if (
      !Array.isArray(value) ||
      value.length > maxItems ||
      value.some((item) => !Number.isSafeInteger(item))
    )
      throw new ClickUpApiError(
        "provider_validation_error",
        `${field} is invalid`,
      );
    return value as number[];
  }

  private idempotencyKey(value: unknown) {
    const key = this.requiredText(value, "idempotencyKey", 128);
    if (key.length < 8)
      throw new ClickUpApiError(
        "provider_validation_error",
        "idempotencyKey is too short",
      );
    return key;
  }

  private requiredId(value: unknown, field: string) {
    const id = this.requiredText(value, field, 100);
    if (!/^[A-Za-z0-9_-]+$/.test(id))
      throw new ClickUpApiError(
        "provider_validation_error",
        `${field} is invalid`,
      );
    return id;
  }

  private optionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredId(value, field);
  }

  private requiredText(value: unknown, field: string, max: number) {
    const text = this.optionalText(value, field, max);
    if (!text)
      throw new ClickUpApiError(
        "provider_validation_error",
        `${field} is required`,
      );
    return text;
  }

  private optionalText(value: unknown, field: string, max: number) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string" || value.trim().length > max)
      throw new ClickUpApiError(
        "provider_validation_error",
        `${field} is invalid`,
      );
    return value.trim() || null;
  }

  private limit(value: unknown, fallback: number, max: number) {
    if (value === undefined) return fallback;
    if (
      !Number.isInteger(value) ||
      (value as number) < 1 ||
      (value as number) > max
    )
      throw new ClickUpApiError(
        "provider_validation_error",
        `maxResults must be between 1 and ${max}`,
      );
    return value as number;
  }

  private safeUrl(value: unknown) {
    const text = this.text(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
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
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    return null;
  }
}
