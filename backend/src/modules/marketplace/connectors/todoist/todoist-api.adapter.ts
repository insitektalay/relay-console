import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type TodoistCredentials = {
  accessToken: string;
  userId: string;
};

export class TodoistApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TodoistApiAdapter {
  private readonly apiOrigin = "https://api.todoist.com/api/v1";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: TodoistCredentials) {
    const user = this.record(
      await this.rawRequest(credentials, { method: "GET", path: "/user" }),
    );
    const userId = this.id(user.id, "user");
    if (userId !== credentials.userId)
      throw new TodoistApiError(
        "insufficient_scope",
        "Todoist authorizing-user binding changed.",
        403,
      );
    return { userId, apiOrigin: this.apiOrigin };
  }

  async listProjects(
    credentials: TodoistCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/projects",
        query: { limit },
      }),
    );
    return {
      projects: this.results(body)
        .slice(0, limit)
        .map((item) => this.project(item)),
    };
  }

  async listTasks(
    credentials: TodoistCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/tasks",
        query: { limit },
      }),
    );
    return {
      tasks: this.results(body)
        .slice(0, limit)
        .map((item) => this.task(item)),
    };
  }

  async getTask(
    credentials: TodoistCredentials,
    input: { taskId: string },
  ) {
    return {
      task: this.task(
        await this.rawRequest(credentials, {
          method: "GET",
          path: `/tasks/${this.id(input.taskId, "task")}`,
        }),
      ),
    };
  }

  async request(
    credentials: TodoistCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    return { data: this.redact(await this.rawRequest(credentials, input)) };
  }

  private async rawRequest(
    credentials: TodoistCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.accessToken.trim())
      throw new TodoistApiError(
        "credential_missing",
        "Todoist access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/[A-Za-z0-9_./:@+-]*$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new TodoistApiError(
        "provider_validation_error",
        "Todoist method or relative API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw new TodoistApiError(
        "provider_validation_error",
        "Todoist request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(input.path.slice(1), `${this.apiOrigin}/`);
    this.appendQuery(url.searchParams, input.query);
    return this.response(
      await this.requester(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole-Todoist/1.0",
        },
        body: serialized,
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new TodoistApiError(
        "provider_validation_error",
        "Todoist response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new TodoistApiError(
        "provider_validation_error",
        "Todoist response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new TodoistApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ?? `Todoist returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private project(value: unknown) {
    const item = this.record(value);
    return {
      projectId: this.id(item.id, "project"),
      name: this.text(item.name, 500),
      role: this.text(item.role, 100),
      viewStyle: this.text(item.view_style, 100),
      favorite: item.is_favorite === true,
      archived: item.is_archived === true,
      inbox: item.inbox_project === true,
      createdAt: this.date(item.created_at),
      updatedAt: this.date(item.updated_at),
    };
  }

  private task(value: unknown) {
    const item = this.record(value);
    const due = this.record(item.due);
    const deadline = this.record(item.deadline);
    const duration = this.record(item.duration);
    return {
      taskId: this.id(item.id, "task"),
      content: this.text(item.content, 10_000),
      projectId: this.optionalId(item.project_id),
      sectionId: this.optionalId(item.section_id),
      parentId: this.optionalId(item.parent_id),
      priority: this.number(item.priority),
      dueDate: this.text(due.date, 100) || null,
      dueString: this.text(due.string, 500) || null,
      dueTimezone: this.text(due.timezone, 200) || null,
      deadlineDate: this.text(deadline.date, 100) || null,
      durationAmount: this.number(duration.amount),
      durationUnit: this.text(duration.unit, 100) || null,
      createdAt: this.date(item.added_at ?? item.created_at),
      updatedAt: this.date(item.updated_at),
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new TodoistApiError(
          "policy_blocked",
          "Todoist request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return void item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new TodoistApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    walk(value);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw new TodoistApiError(
        "provider_validation_error",
        "Todoist query has too many fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item.slice(0, 100) : [item];
      values.forEach((entry) =>
        params.append(key.slice(0, 200), String(entry).slice(0, 10_000)),
      );
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject).slice(0, 500))
      out[key] =
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
          ? "[redacted]"
          : this.redact(item, depth + 1);
    return out;
  }

  private results(value: JsonObject) {
    return Array.isArray(value.results) ? value.results : [];
  }

  private errorMessage(value: unknown) {
    const body = this.record(value);
    return (
      this.text(body.error, 1000) ||
      this.text(body.error_tag, 1000) ||
      this.text(body.message, 1000)
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }

  private limit(value?: number) {
    return Math.min(
      25,
      Math.max(1, Number.isInteger(value) ? Number(value) : 25),
    );
  }

  private id(value: unknown, kind: string) {
    const id = String(value ?? "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id))
      throw new TodoistApiError(
        "provider_validation_error",
        `Todoist ${kind} ID is invalid.`,
      );
    return id;
  }

  private optionalId(value: unknown) {
    return value === null || value === undefined || value === ""
      ? null
      : this.id(value, "resource");
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private date(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
