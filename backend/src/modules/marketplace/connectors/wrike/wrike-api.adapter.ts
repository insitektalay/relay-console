import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type WrikeCredentials = {
  accessToken: string;
  apiOrigin: string;
  accountId: string;
  userId: string;
};

export class WrikeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class WrikeApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: WrikeCredentials) {
    const account = this.first(
      await this.rawRequest(credentials, { method: "GET", path: "/account" }),
    );
    const contact = this.first(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/contacts",
        query: { me: true },
      }),
    );
    const accountId = this.opaqueId(account.id);
    const userId = this.opaqueId(contact.id);
    if (accountId !== credentials.accountId || userId !== credentials.userId)
      throw new WrikeApiError(
        "insufficient_scope",
        "Wrike account or authorizing-user binding changed.",
        403,
      );
    return {
      accountId,
      userId,
      apiOrigin: this.apiOrigin(credentials.apiOrigin),
    };
  }

  async listProjects(
    credentials: WrikeCredentials,
    input: { limit?: number } = {},
  ) {
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: "/folders",
      query: {
        descendants: false,
        project: true,
        pageSize: this.limit(input.limit),
      },
    });
    return {
      projects: this.data(body)
        .slice(0, this.limit(input.limit))
        .map((value) => this.project(value)),
    };
  }

  async listTasks(
    credentials: WrikeCredentials,
    input: { limit?: number } = {},
  ) {
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: "/tasks",
      query: {
        pageSize: this.limit(input.limit),
        sortField: "UpdatedDate",
        sortOrder: "Desc",
      },
    });
    return {
      tasks: this.data(body)
        .slice(0, this.limit(input.limit))
        .map((value) => this.task(value)),
    };
  }

  async getTask(credentials: WrikeCredentials, input: { taskId: string }) {
    const taskId = this.requiredOpaqueId(input.taskId, "task");
    return {
      task: this.task(
        this.first(
          await this.rawRequest(credentials, {
            method: "GET",
            path: `/tasks/${taskId}`,
          }),
        ),
      ),
    };
  }

  async request(
    credentials: WrikeCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      form?: JsonObject;
    },
  ) {
    return { data: this.redact(await this.rawRequest(credentials, input)) };
  }

  private async rawRequest(
    credentials: WrikeCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      form?: JsonObject;
    },
  ) {
    if (!credentials.accessToken.trim())
      throw new WrikeApiError(
        "credential_missing",
        "Wrike access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/[A-Za-z0-9_./:@+-]+$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new WrikeApiError(
        "provider_validation_error",
        "Wrike method or relative API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.form);
    const url = new URL(
      input.path.slice(1),
      `${this.apiOrigin(credentials.apiOrigin)}/`,
    );
    this.appendParams(url.searchParams, input.query);
    const form = new URLSearchParams();
    this.appendParams(form, input.form);
    const serialized = input.form ? form.toString() : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw new WrikeApiError(
        "provider_validation_error",
        "Wrike request body exceeds the 1 MB Relay boundary.",
      );
    return this.response(
      await this.requester(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          ...(serialized
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body: serialized,
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new WrikeApiError(
        "provider_validation_error",
        "Wrike response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new WrikeApiError(
        "provider_validation_error",
        "Wrike response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new WrikeApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ?? `Wrike returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private apiOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new WrikeApiError(
        "credential_missing",
        "Wrike regional API origin is missing.",
      );
    }
    if (
      url.protocol !== "https:" ||
      !(url.hostname === "wrike.com" || url.hostname.endsWith(".wrike.com")) ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname.replace(/\/+$/, "") !== "/api/v4" ||
      url.search ||
      url.hash
    )
      throw new WrikeApiError(
        "credential_missing",
        "Wrike regional API origin is invalid.",
      );
    return `${url.origin}/api/v4`;
  }

  private project(value: unknown) {
    const item = this.record(value);
    return {
      projectId: this.opaqueId(item.id),
      title: this.text(item.title, 500),
      scope: this.text(item.scope, 100),
      projectStatus: this.text(this.record(item.project).status, 200),
      createdAt: this.date(item.createdDate),
      updatedAt: this.date(item.updatedDate),
    };
  }

  private task(value: unknown) {
    const item = this.record(value);
    return {
      taskId: this.opaqueId(item.id),
      title: this.text(item.title, 1000),
      status: this.text(item.status, 200),
      importance: this.text(item.importance, 100),
      type: this.text(item.type, 100),
      createdAt: this.date(item.createdDate),
      updatedAt: this.date(item.updatedDate),
      dueOn: this.date(this.record(item.dates).due),
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new WrikeApiError(
          "policy_blocked",
          "Wrike request is too deeply nested.",
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
          throw new WrikeApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    walk(value);
  }

  private appendParams(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw new WrikeApiError(
        "provider_validation_error",
        "Wrike request has too many fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item.slice(0, 100) : [item];
      values.forEach((entry) =>
        params.append(
          key.slice(0, 200),
          typeof entry === "object"
            ? JSON.stringify(entry).slice(0, 10_000)
            : String(entry).slice(0, 10_000),
        ),
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
    const candidate =
      body.errorDescription ??
      body.error_description ??
      body.message ??
      body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private requiredOpaqueId(value: string, kind: string) {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(value))
      throw new WrikeApiError(
        "provider_validation_error",
        `A valid Wrike ${kind} ID is required.`,
      );
    return value;
  }
  private opaqueId(value: unknown) {
    const text = String(value ?? "");
    return /^[A-Za-z0-9_-]{1,200}$/.test(text) ? text : null;
  }
  private limit(value?: number) {
    return Math.max(1, Math.min(25, Math.floor(value ?? 25)));
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
  private data(value: unknown) {
    return Array.isArray(this.record(value).data)
      ? (this.record(value).data as unknown[])
      : [];
  }
  private first(value: unknown) {
    return this.record(this.data(value)[0]);
  }
}
