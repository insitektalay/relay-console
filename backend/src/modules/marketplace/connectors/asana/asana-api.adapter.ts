import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class AsanaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AsanaApiAdapter {
  private readonly origin = "https://app.asana.com";
  private readonly taskFields =
    "gid,name,completed,assignee.gid,assignee.name,due_on,memberships.project.gid,memberships.project.name,permalink_url,modified_at,notes,created_at,start_on,resource_subtype";

  async getIdentity(accessToken: string) {
    const data = this.object(
      (
        await this.request(accessToken, "GET", "/api/1.0/users/me", {
          opt_fields: "gid,name,email,workspaces.gid,workspaces.name",
        })
      ).data,
    );
    const userGid = this.requiredGid(data.gid, "user.gid");
    const workspaces = this.array(data.workspaces)
      .slice(0, 100)
      .map((value) => this.shapeNamed(value));
    return {
      userGid,
      name: this.text(data.name),
      email: this.text(data.email),
      workspaces,
    };
  }

  async searchTasks(accessToken: string, input: JsonObject) {
    const workspaceGid = this.requiredGid(input.workspaceGid, "workspaceGid");
    const maxResults = this.limit(input.maxResults, 25);
    const query: Record<string, string> = {
      limit: String(maxResults),
      opt_fields: this.taskFields,
    };
    const text = this.optionalText(input.query, "query", 200);
    const projectGid = this.optionalGid(input.projectGid, "projectGid");
    if (text) query.text = text;
    if (projectGid) query["projects.any"] = projectGid;
    if (typeof input.completed === "boolean")
      query.completed = String(input.completed);
    const envelope = await this.request(
      accessToken,
      "GET",
      `/api/1.0/workspaces/${encodeURIComponent(workspaceGid)}/tasks/search`,
      query,
    );
    const tasks = this.array(envelope.data)
      .slice(0, maxResults)
      .map((value) => this.shapeTask(value, 1000));
    return {
      workspaceGid,
      query: text,
      projectGid,
      tasks,
      count: tasks.length,
      hasMore: Boolean(this.text(this.object(envelope.next_page).offset)),
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async listProjects(accessToken: string, input: JsonObject) {
    const workspaceGid = this.requiredGid(input.workspaceGid, "workspaceGid");
    const maxResults = this.limit(input.maxResults, 25);
    const envelope = await this.request(
      accessToken,
      "GET",
      `/api/1.0/workspaces/${encodeURIComponent(workspaceGid)}/projects`,
      {
        limit: String(maxResults),
        opt_fields:
          "gid,name,archived,owner.gid,owner.name,team.gid,team.name,permalink_url,modified_at",
      },
    );
    const projects = this.array(envelope.data)
      .slice(0, maxResults)
      .map((value) => this.shapeProject(value));
    return {
      workspaceGid,
      projects,
      count: projects.length,
      hasMore: Boolean(this.text(this.object(envelope.next_page).offset)),
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async getTask(accessToken: string, input: JsonObject) {
    const taskGid = this.requiredGid(input.taskGid, "taskGid");
    const maxNotesChars =
      input.maxNotesChars === undefined
        ? 4000
        : this.limit(input.maxNotesChars, 4000);
    const envelope = await this.request(
      accessToken,
      "GET",
      `/api/1.0/tasks/${encodeURIComponent(taskGid)}`,
      { opt_fields: this.taskFields },
    );
    return {
      task: this.shapeTask(envelope.data, maxNotesChars),
      providerRequestCount: 1,
    };
  }

  async createTask(accessToken: string, input: JsonObject) {
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const data = this.taskFieldsForWrite(input, true);
    const envelope = await this.request(
      accessToken,
      "POST",
      "/api/1.0/tasks",
      { opt_fields: "gid,name,completed,permalink_url" },
      { data },
    );
    return {
      task: this.shapeTask(envelope.data, 0),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async updateTask(accessToken: string, input: JsonObject) {
    const taskGid = this.requiredGid(input.taskGid, "taskGid");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const data = this.taskFieldsForWrite(input, false);
    if (!Object.keys(data).length)
      throw new AsanaApiError(
        "provider_validation_error",
        "At least one task field must be provided",
      );
    const envelope = await this.request(
      accessToken,
      "PUT",
      `/api/1.0/tasks/${encodeURIComponent(taskGid)}`,
      { opt_fields: "gid,name,completed,permalink_url" },
      { data },
    );
    return {
      task: this.shapeTask(envelope.data, 0),
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
      throw new AsanaApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Asana request timed out"
          : "Asana request failed",
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
        response.status === 402
          ? "Asana task search requires a paid workspace or eligible premium user"
          : response.status === 401
            ? "Asana authorization expired"
            : response.status === 403
              ? "Asana did not grant this operation"
              : response.status === 429
                ? "Asana rate limit reached"
                : response.status >= 500
                  ? "Asana is temporarily unavailable"
                  : "Asana rejected the bounded request";
      throw new AsanaApiError(code, message, response.status);
    }
    return envelope;
  }

  private taskFieldsForWrite(input: JsonObject, creating: boolean) {
    const data: JsonObject = {};
    if (creating) {
      data.name = this.requiredText(input.name, "name", 512);
      const workspaceGid = this.optionalGid(input.workspaceGid, "workspaceGid");
      const projectGid = this.optionalGid(input.projectGid, "projectGid");
      if (!workspaceGid && !projectGid)
        throw new AsanaApiError(
          "provider_validation_error",
          "workspaceGid or projectGid is required",
        );
      if (workspaceGid) data.workspace = workspaceGid;
      if (projectGid) data.projects = [projectGid];
    } else if (input.name !== undefined)
      data.name = this.requiredText(input.name, "name", 512);
    if (input.notes !== undefined)
      data.notes = this.optionalText(input.notes, "notes", 16000) ?? "";
    if (input.assigneeGid !== undefined)
      data.assignee = this.requiredGid(input.assigneeGid, "assigneeGid");
    if (input.dueOn !== undefined) {
      const dueOn = this.requiredText(input.dueOn, "dueOn", 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn))
        throw new AsanaApiError(
          "provider_validation_error",
          "dueOn must be YYYY-MM-DD",
        );
      data.due_on = dueOn;
    }
    if (typeof input.completed === "boolean") data.completed = input.completed;
    return data;
  }

  private shapeTask(value: unknown, notesLimit: number) {
    const task = this.object(value);
    const notes = this.text(task.notes) ?? "";
    const memberships = this.array(task.memberships);
    return {
      gid: this.requiredGid(task.gid, "task.gid"),
      name: this.text(task.name),
      completed: task.completed === true,
      assignee: this.shapeNamed(task.assignee),
      dueOn: this.text(task.due_on),
      projects: memberships
        .slice(0, 25)
        .map((membership) => this.shapeNamed(this.object(membership).project))
        .filter(Boolean),
      permalinkUrl: this.asanaUrl(task.permalink_url),
      modifiedAt: this.isoDate(task.modified_at),
      createdAt: this.isoDate(task.created_at),
      startOn: this.text(task.start_on),
      resourceSubtype: this.text(task.resource_subtype),
      notesExcerpt: notes.slice(0, notesLimit),
      notesTruncated: notes.length > notesLimit,
    };
  }
  private shapeProject(value: unknown) {
    const project = this.object(value);
    return {
      gid: this.requiredGid(project.gid, "project.gid"),
      name: this.text(project.name),
      archived: project.archived === true,
      owner: this.shapeNamed(project.owner),
      team: this.shapeNamed(project.team),
      permalinkUrl: this.asanaUrl(project.permalink_url),
      modifiedAt: this.isoDate(project.modified_at),
    };
  }
  private shapeNamed(value: unknown) {
    const item = this.object(value);
    const gid = this.text(item.gid);
    return gid ? { gid, name: this.text(item.name) } : null;
  }
  private limit(value: unknown, maximum: number) {
    const number = value === undefined ? Math.min(25, maximum) : Number(value);
    if (!Number.isInteger(number) || number < 1 || number > maximum)
      throw new AsanaApiError(
        "provider_validation_error",
        `limit must be between one and ${maximum}`,
      );
    return number;
  }
  private requiredGid(value: unknown, field: string) {
    return this.requiredText(value, field, 100);
  }
  private optionalGid(value: unknown, field: string) {
    return value === undefined || value === null || value === ""
      ? null
      : this.requiredGid(value, field);
  }
  private idempotencyKey(value: unknown) {
    const key = this.text(value);
    if (
      !key ||
      key.length < 8 ||
      key.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(key)
    )
      throw new AsanaApiError(
        "provider_validation_error",
        "idempotencyKey is invalid",
      );
    return key;
  }
  private requiredText(value: unknown, field: string, max: number) {
    const text = this.text(value)?.trim();
    if (!text || text.length > max)
      throw new AsanaApiError(
        "provider_validation_error",
        `${field} is required and must be ${max} characters or fewer`,
      );
    return text;
  }
  private optionalText(value: unknown, field: string, max: number) {
    if (value === undefined || value === null) return null;
    const text = this.text(value);
    if (text === null || text.length > max)
      throw new AsanaApiError(
        "provider_validation_error",
        `${field} must be ${max} characters or fewer`,
      );
    return text;
  }
  private asanaUrl(value: unknown) {
    const text = this.text(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" &&
        (url.hostname === "app.asana.com" ||
          url.hostname.endsWith(".asana.com"))
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
  private isoDate(value: unknown) {
    const text = this.text(value);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private text(value: unknown) {
    return typeof value === "string" ? value : null;
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
