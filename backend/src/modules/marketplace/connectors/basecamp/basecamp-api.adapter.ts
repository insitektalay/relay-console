import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type BasecampCredentials = {
  accessToken: string;
  accountOrigin: string;
  accountId: string;
};

export class BasecampApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class BasecampApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: BasecampCredentials) {
    const accountOrigin = this.accountOrigin(credentials.accountOrigin);
    const response = await this.requester(
      "https://launchpad.37signals.com/authorization.json",
      this.requestInit(credentials.accessToken, "GET"),
    );
    const body = this.record(await this.response(response));
    const account = this.array(body.accounts)
      .map((value) => this.record(value))
      .find(
        (value) =>
          value.product === "bc3" &&
          this.numericId(value.id) === credentials.accountId,
      );
    if (
      !account ||
      this.accountOrigin(this.text(account.href, 500) ?? "") !== accountOrigin
    )
      throw new BasecampApiError(
        "insufficient_scope",
        "Basecamp account binding changed or is no longer available.",
        403,
      );
    return { accountId: credentials.accountId, accountOrigin };
  }

  async listProjects(
    credentials: BasecampCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: "/projects.json",
    });
    return {
      projects: this.array(body)
        .slice(0, limit)
        .map((value) => this.project(value)),
    };
  }

  async getProject(
    credentials: BasecampCredentials,
    input: { projectId: string },
  ) {
    const projectId = this.requiredNumericId(input.projectId, "project");
    return {
      project: this.project(
        await this.rawRequest(credentials, {
          method: "GET",
          path: `/projects/${projectId}.json`,
        }),
      ),
    };
  }

  async getTodo(credentials: BasecampCredentials, input: { todoId: string }) {
    const todoId = this.requiredNumericId(input.todoId, "to-do");
    return {
      todo: this.todo(
        await this.rawRequest(credentials, {
          method: "GET",
          path: `/todos/${todoId}.json`,
        }),
      ),
    };
  }

  async request(
    credentials: BasecampCredentials,
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
    credentials: BasecampCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.accessToken.trim())
      throw new BasecampApiError(
        "credential_missing",
        "Basecamp access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/[A-Za-z0-9_./:@+-]+$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new BasecampApiError(
        "provider_validation_error",
        "Basecamp method or relative API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw new BasecampApiError(
        "provider_validation_error",
        "Basecamp request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(
      input.path.slice(1),
      `${this.accountOrigin(credentials.accountOrigin)}/`,
    );
    this.appendQuery(url.searchParams, input.query);
    const response = await this.requester(
      url,
      this.requestInit(credentials.accessToken, method, serialized),
    );
    return this.response(response);
  }

  private requestInit(
    accessToken: string,
    method: string,
    body?: string,
  ): RequestInit {
    return {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "RelayConsole (support@relayconsole.work)",
      },
      body,
    };
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new BasecampApiError(
        "provider_validation_error",
        "Basecamp response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BasecampApiError(
        "provider_validation_error",
        "Basecamp response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new BasecampApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ?? `Basecamp returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private accountOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BasecampApiError(
        "credential_missing",
        "Basecamp account API origin is missing.",
      );
    }
    const accountId = url.pathname.replace(/^\/+|\/+$/g, "");
    if (
      url.protocol !== "https:" ||
      url.hostname !== "3.basecampapi.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !/^[1-9][0-9]{0,18}$/.test(accountId)
    )
      throw new BasecampApiError(
        "credential_missing",
        "Basecamp account API origin is invalid.",
      );
    return `${url.origin}/${accountId}`;
  }

  private project(value: unknown) {
    const item = this.record(value);
    return {
      projectId: this.numericId(item.id),
      name: this.text(item.name, 500),
      status: this.text(item.status, 100),
      purpose: this.text(item.purpose, 1000),
      createdAt: this.date(item.created_at),
      updatedAt: this.date(item.updated_at),
      clientsEnabled: item.clients_enabled === true,
      timesheetEnabled: item.timesheet_enabled === true,
    };
  }

  private todo(value: unknown) {
    const item = this.record(value);
    const parent = this.record(item.parent);
    const bucket = this.record(item.bucket);
    return {
      todoId: this.numericId(item.id),
      title: this.text(item.content ?? item.title, 1000),
      status: this.text(item.status, 100),
      completed: item.completed === true,
      startsOn: this.date(item.starts_on),
      dueOn: this.date(item.due_on),
      createdAt: this.date(item.created_at),
      updatedAt: this.date(item.updated_at),
      parentId: this.numericId(parent.id),
      parentTitle: this.text(parent.title, 500),
      projectId: this.numericId(bucket.id),
      projectName: this.text(bucket.name, 500),
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new BasecampApiError(
          "policy_blocked",
          "Basecamp request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new BasecampApiError(
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
      throw new BasecampApiError(
        "provider_validation_error",
        "Basecamp query has too many fields.",
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
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    const body = this.record(value);
    const candidate = body.message ?? body.error_description ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private requiredNumericId(value: string, kind: string) {
    if (!/^[1-9][0-9]{0,18}$/.test(value))
      throw new BasecampApiError(
        "provider_validation_error",
        `A valid Basecamp ${kind} ID is required.`,
      );
    return value;
  }

  private limit(value?: number) {
    return Math.max(1, Math.min(25, Math.floor(value ?? 25)));
  }

  private numericId(value: unknown) {
    const text = String(value ?? "");
    return /^[1-9][0-9]{0,18}$/.test(text) ? text : null;
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private date(value: unknown) {
    return typeof value === "string" ? value.slice(0, 100) : null;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
}
