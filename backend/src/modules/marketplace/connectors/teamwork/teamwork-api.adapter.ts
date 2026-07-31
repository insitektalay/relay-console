import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type TeamworkCredentials = {
  accessToken: string;
  apiOrigin: string;
  installationId: string;
};

export class TeamworkApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TeamworkApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: TeamworkCredentials) {
    this.apiOrigin(credentials.apiOrigin);
    const response = await this.requester(
      "https://www.teamwork.com/launchpad/v1/userinfo.json",
      this.requestInit(credentials.accessToken, "GET"),
    );
    const body = await this.response(response);
    const record = this.record(body);
    const installationId = this.numericId(
      record.installation_id ?? record.installationId,
    );
    if (!installationId || installationId !== credentials.installationId) {
      throw new TeamworkApiError(
        "insufficient_scope",
        "Teamwork installation binding changed or is no longer available.",
        403,
      );
    }
    return { installationId, apiOrigin: credentials.apiOrigin };
  }

  async listProjects(
    credentials: TeamworkCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/projects/api/v3/projects.json",
        query: { pageSize: limit },
      }),
    );
    return {
      projects: this.array(body.projects)
        .slice(0, limit)
        .map((value) => this.project(value)),
      meta: this.pagination(body.meta),
    };
  }

  async listTasks(
    credentials: TeamworkCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/projects/api/v3/tasks.json",
        query: { pageSize: limit },
      }),
    );
    return {
      tasks: this.array(body.tasks)
        .slice(0, limit)
        .map((value) => this.task(value)),
      meta: this.pagination(body.meta),
    };
  }

  async getTask(credentials: TeamworkCredentials, input: { taskId: string }) {
    const taskId = this.requiredNumericId(input.taskId, "task");
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: `/projects/api/v3/tasks/${taskId}.json`,
      }),
    );
    return { task: this.task(body.task ?? body) };
  }

  async request(
    credentials: TeamworkCredentials,
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
    credentials: TeamworkCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.accessToken.trim())
      throw new TeamworkApiError(
        "credential_missing",
        "Teamwork access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/projects\/api\/[A-Za-z0-9_./:@+-]*$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new TeamworkApiError(
        "provider_validation_error",
        "Teamwork method or Projects API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw new TeamworkApiError(
        "provider_validation_error",
        "Teamwork request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(input.path, this.apiOrigin(credentials.apiOrigin));
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
        "Content-Type": "application/json",
        "User-Agent": "RelayConsole-Teamwork/1.0",
      },
      body,
    };
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new TeamworkApiError(
        "provider_validation_error",
        "Teamwork response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new TeamworkApiError(
        "provider_validation_error",
        "Teamwork response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new TeamworkApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ?? `Teamwork returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private apiOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new TeamworkApiError(
        "credential_missing",
        "Teamwork installation API origin is missing.",
      );
    }
    if (
      url.protocol !== "https:" ||
      !/^[a-z0-9-]+\.teamwork\.com$/i.test(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname)
    )
      throw new TeamworkApiError(
        "credential_missing",
        "Teamwork installation API origin is invalid.",
      );
    return `${url.origin}/`;
  }

  private project(value: unknown) {
    const item = this.record(value);
    return {
      projectId: this.numericId(item.id),
      name: this.text(item.name, 500),
      status: this.text(item.status, 100),
      startDate: this.date(item.startDate ?? item.startdate),
      endDate: this.date(item.endDate ?? item.enddate),
      companyId: this.numericId(this.record(item.company).id ?? item.companyId),
    };
  }

  private task(value: unknown) {
    const item = this.record(value);
    return {
      taskId: this.numericId(item.id),
      name: this.text(item.name ?? item.content, 500),
      status: this.text(item.status, 100),
      projectId: this.numericId(item.projectId ?? this.record(item.project).id),
      taskListId: this.numericId(
        item.taskListId ?? this.record(item.taskList).id,
      ),
      dueAt: this.date(item.dueAt ?? item.dueDate ?? item.dueDateTime),
      completedAt: this.date(item.completedAt ?? item.completedOn),
    };
  }

  private pagination(value: unknown) {
    const page = this.record(value);
    return {
      page: typeof page.page === "number" ? page.page : null,
      pageSize: typeof page.pageSize === "number" ? page.pageSize : null,
      hasMore: page.hasMore === true,
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new TeamworkApiError(
          "policy_blocked",
          "Teamwork request is too deeply nested.",
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
          throw new TeamworkApiError(
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
      throw new TeamworkApiError(
        "provider_validation_error",
        "Teamwork query has too many fields.",
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

  private requiredNumericId(value: unknown, resource: string) {
    const id = this.numericId(value);
    if (!id)
      throw new TeamworkApiError(
        "provider_validation_error",
        `Teamwork ${resource} ID is invalid.`,
      );
    return id;
  }

  private limit(value?: number) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || value < 1 || value > 25)
      throw new TeamworkApiError(
        "provider_validation_error",
        "Teamwork result limit must be between 1 and 25.",
      );
    return value;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
  private numericId(value: unknown) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.text(value, 20);
    return text && /^[1-9][0-9]{0,18}$/.test(text) ? text : null;
  }
  private text(value: unknown, limit: number) {
    return typeof value === "string" ? value.slice(0, limit) : null;
  }
  private date(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text))
      ? new Date(text).toISOString()
      : null;
  }
}
