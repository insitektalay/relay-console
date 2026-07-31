import { Injectable } from "@nestjs/common";

export class MicrosoftToDoApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_ORIGIN = "https://graph.microsoft.com";
const SAFE_ID = /^[A-Za-z0-9._!~=-]{1,512}$/;

@Injectable()
export class MicrosoftToDoApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(accessToken: string) {
    const result = await this.listTaskLists(accessToken);
    return { reachable: true, resultCount: result.resultCount };
  }

  async listTaskLists(accessToken: string) {
    return this.taskLists(await this.get(accessToken, "/v1.0/me/todo/lists"));
  }

  async getTaskList(accessToken: string, input: Record<string, unknown>) {
    const taskListId = this.id(input.taskListId, "taskListId");
    return {
      taskList: this.taskList(
        this.object(
          await this.get(accessToken, `/v1.0/me/todo/lists/${taskListId}`),
        ),
      ),
    };
  }

  async listTasks(accessToken: string, input: Record<string, unknown>) {
    const taskListId = this.id(input.taskListId, "taskListId");
    return this.tasks(
      await this.get(accessToken, `/v1.0/me/todo/lists/${taskListId}/tasks`),
    );
  }

  async getTask(accessToken: string, input: Record<string, unknown>) {
    const taskListId = this.id(input.taskListId, "taskListId");
    const taskId = this.id(input.taskId, "taskId");
    return {
      task: this.task(
        this.object(
          await this.get(
            accessToken,
            `/v1.0/me/todo/lists/${taskListId}/tasks/${taskId}`,
          ),
        ),
      ),
    };
  }

  private async get(accessToken: string, path: string) {
    if (!accessToken.trim())
      throw new MicrosoftToDoApiError(
        "microsoft_todo_token_invalid",
        "Microsoft To Do connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (
      url.origin !== API_ORIGIN ||
      !/^\/v1\.0\/me\/todo\/lists(?:\/[A-Za-z0-9._!~=-]{1,512}(?:\/tasks(?:\/[A-Za-z0-9._!~=-]{1,512})?)?)?$/.test(
        url.pathname,
      ) ||
      /\/(attachments|checklistItems|extensions|linkedResources|delta)(\/|$)/i.test(
        url.pathname,
      )
    )
      throw new MicrosoftToDoApiError(
        "microsoft_todo_path_blocked",
        "Microsoft To Do request path is outside the bounded delegated-read V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MicrosoftToDoApiError(
        "microsoft_todo_unavailable",
        "Microsoft Graph To Do is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new MicrosoftToDoApiError(
        "microsoft_todo_response_too_large",
        "Microsoft Graph To Do response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MicrosoftToDoApiError(
        "microsoft_todo_response_invalid",
        "Microsoft Graph returned an invalid To Do response.",
      );
    }
    if (!response.ok)
      throw new MicrosoftToDoApiError(
        response.status === 401
          ? "microsoft_todo_token_invalid"
          : response.status === 403
            ? "microsoft_todo_permission_denied"
            : response.status === 404
              ? "microsoft_todo_not_found"
              : response.status === 429
                ? "microsoft_todo_rate_limited"
                : "microsoft_todo_graph_error",
        "Microsoft Graph To Do request failed.",
        response.status,
      );
    return body;
  }

  private taskLists(value: unknown) {
    const root = this.object(value);
    const rows = Array.isArray(root.value)
      ? root.value.slice(0, 25).map((row) => this.taskList(this.object(row)))
      : [];
    return {
      taskLists: rows,
      resultCount: rows.length,
      nextPageFollowed: false,
    };
  }

  private tasks(value: unknown) {
    const root = this.object(value);
    const rows = Array.isArray(root.value)
      ? root.value.slice(0, 25).map((row) => this.task(this.object(row)))
      : [];
    return { tasks: rows, resultCount: rows.length, nextPageFollowed: false };
  }

  private taskList(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.id),
      displayName: this.scalar(row.displayName),
      isOwner: this.scalar(row.isOwner),
      isShared: this.scalar(row.isShared),
      wellknownListName: this.scalar(row.wellknownListName),
      extensionsExcluded: true,
    };
  }

  private task(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.id),
      title: this.scalar(row.title),
      status: this.scalar(row.status),
      importance: this.scalar(row.importance),
      createdDateTime: this.scalar(row.createdDateTime),
      lastModifiedDateTime: this.scalar(row.lastModifiedDateTime),
      completedDateTime: this.dateTime(row.completedDateTime),
      dueDateTime: this.dateTime(row.dueDateTime),
      startDateTime: this.dateTime(row.startDateTime),
      reminderDateTime: this.dateTime(row.reminderDateTime),
      isReminderOn: this.scalar(row.isReminderOn),
      hasAttachments: this.scalar(row.hasAttachments),
      bodyExcluded: true,
      categoriesExcluded: true,
      relatedContentExcluded: true,
    };
  }

  private dateTime(value: unknown) {
    return this.scalar(this.object(value).dateTime);
  }

  private id(value: unknown, field: string) {
    if (typeof value !== "string" || !SAFE_ID.test(value))
      throw new MicrosoftToDoApiError(
        "microsoft_todo_input_invalid",
        `A safe explicit ${field} is required.`,
      );
    return value;
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
}
