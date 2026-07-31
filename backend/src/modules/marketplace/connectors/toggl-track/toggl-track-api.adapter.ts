import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type TogglTrackCredentials = { apiToken: string };

export class TogglTrackApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TogglTrackApiAdapter {
  private readonly apiOrigin = "https://api.track.toggl.com/api/v9";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: TogglTrackCredentials) {
    const profile = this.record(
      await this.rawRequest(credentials, { method: "GET", path: "/me" }),
    );
    const userId = this.integer(profile.id);
    if (!userId)
      throw new TogglTrackApiError(
        "provider_validation_error",
        "Toggl Track returned an unexpected profile response.",
      );
    return { userId, apiOrigin: this.apiOrigin };
  }

  async getProfile(credentials: TogglTrackCredentials) {
    const profile = this.record(
      await this.rawRequest(credentials, { method: "GET", path: "/me" }),
    );
    return {
      userId: this.integer(profile.id),
      fullName: this.text(profile.fullname, 500) || null,
      timezone: this.text(profile.timezone, 200) || null,
      beginningOfWeek: this.number(profile.beginning_of_week),
      workspaceIds: (Array.isArray(profile.workspace_ids)
        ? profile.workspace_ids
        : []
      )
        .slice(0, 100)
        .map((item) => this.integer(item))
        .filter((item): item is number => item !== null),
    };
  }

  async listWorkspaces(
    credentials: TogglTrackCredentials,
    input: { limit?: number } = {},
  ) {
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: "/me/workspaces",
    });
    return {
      workspaces: (Array.isArray(body) ? body : [])
        .slice(0, this.limit(input.limit))
        .map((item) => this.workspace(item)),
    };
  }

  async listProjects(
    credentials: TogglTrackCredentials,
    input: { workspaceId: number; limit?: number },
  ) {
    const workspaceId = this.positiveInteger(input.workspaceId, "workspaceId");
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: `/workspaces/${workspaceId}/projects`,
      query: { active: true },
    });
    return {
      projects: (Array.isArray(body) ? body : [])
        .slice(0, this.limit(input.limit))
        .map((item) => this.project(item)),
    };
  }

  async listTimeEntries(
    credentials: TogglTrackCredentials,
    input: { startDate: string; endDate: string; limit?: number },
  ) {
    const startDate = this.rfc3339(input.startDate, "startDate");
    const endDate = this.rfc3339(input.endDate, "endDate");
    const span = Date.parse(endDate) - Date.parse(startDate);
    if (span < 0 || span > 90 * 24 * 60 * 60 * 1000)
      throw this.invalid(
        "Toggl Track time-entry windows must be between zero and ninety days.",
      );
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: "/me/time_entries",
      query: { start_date: startDate, end_date: endDate },
    });
    return {
      timeEntries: (Array.isArray(body) ? body : [])
        .slice(0, this.limit(input.limit))
        .map((item) => this.timeEntry(item)),
    };
  }

  async request(
    credentials: TogglTrackCredentials,
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
    credentials: TogglTrackCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const token = credentials.apiToken.trim();
    if (!token || token.length > 16_000 || /[\r\n:]/.test(token))
      throw new TogglTrackApiError(
        "credential_missing",
        "A valid Toggl Track personal API token is required.",
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
      throw this.invalid("Toggl Track method or relative API path is invalid.");
    if (
      /^\/(auth|sessions?|desktop_login|desktop_login_tokens)(\/|$)/i.test(
        input.path,
      ) ||
      /^\/me\/(password|close_account)(\/|$)/i.test(input.path) ||
      /^\/ical\//i.test(input.path)
    )
      throw new TogglTrackApiError(
        "policy_blocked",
        "Toggl Track authentication, account-closure and credential-bearing calendar routes are not agent tools.",
        403,
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw this.invalid(
        "Toggl Track request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(input.path.slice(1), `${this.apiOrigin}/`);
    this.appendQuery(url.searchParams, input.query);
    let response: Response;
    try {
      response = await this.requester(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${token}:api_token`).toString("base64")}`,
          ...(serialized ? { "Content-Type": "application/json" } : {}),
          "User-Agent": "RelayConsole-TogglTrack/1.0",
        },
        body: serialized,
      });
    } catch (error) {
      if (error instanceof TogglTrackApiError) throw error;
      throw new TogglTrackApiError(
        "provider_unavailable",
        "Toggl Track could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw this.invalid(
        "Toggl Track response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new TogglTrackApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ??
          `Toggl Track returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private workspace(value: unknown) {
    const item = this.record(value);
    return {
      workspaceId: this.integer(item.id),
      name: this.text(item.name, 500),
      organizationId: this.integer(item.organization_id),
      active: item.active !== false,
      premium: item.premium === true,
    };
  }

  private project(value: unknown) {
    const item = this.record(value);
    return {
      projectId: this.integer(item.id),
      workspaceId: this.integer(item.workspace_id),
      name: this.text(item.name, 1_000),
      active: item.active !== false,
      color: this.text(item.color, 100) || null,
      estimatedSeconds: this.number(item.estimated_seconds),
      createdAt: this.date(item.at),
    };
  }

  private timeEntry(value: unknown) {
    const item = this.record(value);
    return {
      timeEntryId: this.integer(item.id),
      workspaceId: this.integer(item.workspace_id),
      projectId: this.integer(item.project_id),
      taskId: this.integer(item.task_id),
      description: this.text(item.description, 10_000),
      start: this.date(item.start),
      stop: this.date(item.stop),
      duration: this.number(item.duration),
      tags: Array.isArray(item.tags)
        ? item.tags.slice(0, 100).map((tag) => this.text(tag, 500))
        : [],
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new TogglTrackApiError(
          "policy_blocked",
          "Toggl Track request is too deeply nested.",
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
          throw new TogglTrackApiError(
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
      throw this.invalid("Toggl Track query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(key))
        throw this.invalid(`Toggl Track query parameter ${key} is invalid.`);
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.invalid(`Toggl Track query ${key} has too many values.`);
      for (const entry of values) {
        if (typeof entry === "object")
          throw this.invalid(`Toggl Track query ${key} must be scalar.`);
        const text = String(entry);
        if (text.length > 2_000 || /[\r\n]/.test(text))
          throw this.invalid(`Toggl Track query ${key} is invalid.`);
        params.append(key, text);
      }
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
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
    const item = this.record(value);
    return (
      this.text(item.error, 1_000) || this.text(item.message, 1_000) || null
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }

  private rfc3339(value: string, name: string) {
    const text = String(value ?? "").trim();
    if (!text || text.length > 100 || Number.isNaN(Date.parse(text)))
      throw this.invalid(`Toggl Track ${name} must be an RFC3339 timestamp.`);
    return text;
  }

  private positiveInteger(value: unknown, name: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
      throw this.invalid(`Toggl Track ${name} must be a positive integer.`);
    return number;
  }

  private integer(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private limit(value?: number) {
    return Math.min(
      25,
      Math.max(1, Number.isInteger(value) ? Number(value) : 25),
    );
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : "";
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

  private invalid(message: string) {
    return new TogglTrackApiError("provider_validation_error", message, 400);
  }
}
