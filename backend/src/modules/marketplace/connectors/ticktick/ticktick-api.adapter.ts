import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type TickTickCredentials = { accessToken: string };

export class TickTickApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TickTickApiAdapter {
  private readonly apiOrigin = "https://api.ticktick.com/open/v1";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: TickTickCredentials) {
    const projects = await this.rawRequest(credentials, {
      method: "GET",
      path: "/project",
    });
    if (!Array.isArray(projects))
      throw new TickTickApiError(
        "provider_validation_error",
        "TickTick returned an unexpected project response.",
      );
    return { grantVerified: true, apiOrigin: this.apiOrigin };
  }

  async listProjects(
    credentials: TickTickCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: "/project",
    });
    return {
      projects: (Array.isArray(body) ? body : [])
        .slice(0, limit)
        .map((item) => this.project(item)),
    };
  }

  async getProjectData(
    credentials: TickTickCredentials,
    input: { projectId: string; taskLimit?: number },
  ) {
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: `/project/${this.id(input.projectId, "project")}/data`,
      }),
    );
    return {
      project: this.project(body.project),
      tasks: (Array.isArray(body.tasks) ? body.tasks : [])
        .slice(0, this.limit(input.taskLimit))
        .map((item) => this.task(item)),
      columns: (Array.isArray(body.columns) ? body.columns : [])
        .slice(0, 25)
        .map((item) => this.column(item)),
    };
  }

  async getTask(
    credentials: TickTickCredentials,
    input: { projectId: string; taskId: string },
  ) {
    return {
      task: this.task(
        await this.rawRequest(credentials, {
          method: "GET",
          path: `/project/${this.id(input.projectId, "project")}/task/${this.id(input.taskId, "task")}`,
        }),
      ),
    };
  }

  async request(
    credentials: TickTickCredentials,
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
    credentials: TickTickCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.accessToken.trim())
      throw new TickTickApiError(
        "credential_missing",
        "TickTick access token is required.",
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
      throw new TickTickApiError(
        "provider_validation_error",
        "TickTick method or relative API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw new TickTickApiError(
        "provider_validation_error",
        "TickTick request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(input.path.slice(1), `${this.apiOrigin}/`);
    this.appendQuery(url.searchParams, input.query);
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "RelayConsole-TickTick/1.0",
      },
      body: serialized,
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new TickTickApiError(
        "provider_validation_error",
        "TickTick response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new TickTickApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ?? `TickTick returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private project(value: unknown) {
    const item = this.record(value);
    return {
      projectId: this.id(item.id, "project"),
      name: this.text(item.name, 500),
      color: this.text(item.color, 100) || null,
      viewMode: this.text(item.viewMode, 100) || null,
      kind: this.text(item.kind, 100) || null,
      closed: item.closed === true,
      groupId: this.optionalId(item.groupId),
    };
  }

  private task(value: unknown) {
    const item = this.record(value);
    return {
      taskId: this.id(item.id, "task"),
      projectId: this.optionalId(item.projectId),
      title: this.text(item.title, 10_000),
      content: this.text(item.content, 100_000),
      description: this.text(item.desc, 100_000),
      priority: this.number(item.priority),
      status: this.number(item.status),
      startDate: this.date(item.startDate),
      dueDate: this.date(item.dueDate),
      timeZone: this.text(item.timeZone, 200) || null,
      tags: Array.isArray(item.tags)
        ? item.tags.slice(0, 100).map((tag) => this.text(tag, 500))
        : [],
    };
  }

  private column(value: unknown) {
    const item = this.record(value);
    return {
      columnId: this.id(item.id, "column"),
      projectId: this.optionalId(item.projectId),
      name: this.text(item.name, 500),
      sortOrder: this.number(item.sortOrder),
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new TickTickApiError(
          "policy_blocked",
          "TickTick request is too deeply nested.",
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
          throw new TickTickApiError(
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
      throw new TickTickApiError(
        "provider_validation_error",
        "TickTick query has too many fields.",
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

  private errorMessage(value: unknown) {
    const body = this.record(value);
    return this.text(body.error, 1000) || this.text(body.message, 1000);
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
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
      throw new TickTickApiError(
        "provider_validation_error",
        `TickTick ${kind} ID is invalid.`,
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
