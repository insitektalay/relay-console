import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type ClockifyCredentials = {
  apiKey: string;
  apiBaseUrl: string;
  userId?: string;
};

export class ClockifyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ClockifyApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ClockifyCredentials) {
    const profile = this.record(
      await this.rawRequest(credentials, {
        surface: "regular",
        method: "GET",
        path: "/user",
      }),
    );
    const userId = this.identifier(profile.id, "Clockify user ID");
    return {
      userId,
      activeWorkspace: this.optionalIdentifier(profile.activeWorkspace),
      apiOrigin: this.regularOrigin(credentials.apiBaseUrl),
    };
  }

  async getProfile(credentials: ClockifyCredentials) {
    const profile = this.record(
      await this.rawRequest(credentials, {
        surface: "regular",
        method: "GET",
        path: "/user",
      }),
    );
    const userId = this.identifier(profile.id, "Clockify user ID");
    this.requireBoundUser(credentials, userId);
    const settings = this.record(profile.settings);
    return {
      userId,
      name: this.text(profile.name, 500) || null,
      timezone: this.text(settings.timeZone, 200) || null,
      activeWorkspace: this.optionalIdentifier(profile.activeWorkspace),
      defaultWorkspace: this.optionalIdentifier(profile.defaultWorkspace),
      status: this.text(profile.status, 100) || null,
    };
  }

  async listWorkspaces(
    credentials: ClockifyCredentials,
    input: { limit?: number } = {},
  ) {
    this.requireBoundUser(credentials);
    const body = await this.rawRequest(credentials, {
      surface: "regular",
      method: "GET",
      path: "/workspaces",
    });
    return {
      workspaces: (Array.isArray(body) ? body : [])
        .slice(0, this.limit(input.limit))
        .map((item) => this.workspace(item)),
    };
  }

  async listProjects(
    credentials: ClockifyCredentials,
    input: { workspaceId: string; limit?: number },
  ) {
    this.requireBoundUser(credentials);
    const workspaceId = this.identifier(input.workspaceId, "workspaceId");
    const limit = this.limit(input.limit);
    const body = await this.rawRequest(credentials, {
      surface: "regular",
      method: "GET",
      path: `/workspaces/${workspaceId}/projects`,
      query: { archived: false, page: 1, "page-size": limit },
    });
    return {
      projects: (Array.isArray(body) ? body : [])
        .slice(0, limit)
        .map((item) => this.project(item)),
    };
  }

  async listTimeEntries(
    credentials: ClockifyCredentials,
    input: {
      workspaceId: string;
      startDate: string;
      endDate: string;
      limit?: number;
    },
  ) {
    const userId = this.requireBoundUser(credentials);
    const workspaceId = this.identifier(input.workspaceId, "workspaceId");
    const startDate = this.rfc3339(input.startDate, "startDate");
    const endDate = this.rfc3339(input.endDate, "endDate");
    const span = Date.parse(endDate) - Date.parse(startDate);
    if (span < 0 || span > 90 * 24 * 60 * 60 * 1000)
      throw this.invalid(
        "Clockify time-entry windows must be between zero and ninety days.",
      );
    const limit = this.limit(input.limit);
    const body = await this.rawRequest(credentials, {
      surface: "regular",
      method: "GET",
      path: `/workspaces/${workspaceId}/user/${userId}/time-entries`,
      query: {
        start: startDate,
        end: endDate,
        page: 1,
        "page-size": limit,
      },
    });
    return {
      timeEntries: (Array.isArray(body) ? body : [])
        .slice(0, limit)
        .map((item) => this.timeEntry(item)),
    };
  }

  async request(
    credentials: ClockifyCredentials,
    input: {
      surface: string;
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    this.requireBoundUser(credentials);
    return { data: this.redact(await this.rawRequest(credentials, input)) };
  }

  private async rawRequest(
    credentials: ClockifyCredentials,
    input: {
      surface: string;
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 16_000 || /[\r\n]/.test(apiKey))
      throw new ClockifyApiError(
        "credential_missing",
        "A valid Clockify personal API key is required.",
        401,
      );
    const surface = input.surface.toLowerCase();
    if (!/^(regular|reports)$/.test(surface))
      throw this.invalid("Clockify surface must be regular or reports.");
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/[A-Za-z0-9_./:@+-]*$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw this.invalid("Clockify method or relative API path is invalid.");
    if (
      /(^|\/)(api[-_]?keys?|addon[-_]?tokens?|oauth|authentication|sessions?)(\/|$)/i.test(
        input.path,
      )
    )
      throw new ClockifyApiError(
        "policy_blocked",
        "Clockify credential and authentication lifecycle routes are not agent tools.",
        403,
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw this.invalid(
        "Clockify request body exceeds the 1 MB Relay boundary.",
      );
    const origin =
      surface === "regular"
        ? this.regularOrigin(credentials.apiBaseUrl)
        : this.reportsOrigin(credentials.apiBaseUrl);
    const url = new URL(input.path.slice(1), `${origin}/`);
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
          "X-Api-Key": apiKey,
          ...(serialized ? { "Content-Type": "application/json" } : {}),
          "User-Agent": "RelayConsole-Clockify/1.0",
        },
        body: serialized,
      });
    } catch (error) {
      if (error instanceof ClockifyApiError) throw error;
      throw new ClockifyApiError(
        "provider_unavailable",
        "Clockify could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw this.invalid("Clockify response exceeds the 2 MB Relay boundary.");
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new ClockifyApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ?? `Clockify returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private regularOrigin(value: string) {
    const raw = value.trim() || "https://api.clockify.me/api/v1";
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw this.invalid("Clockify API base URL is invalid.");
    }
    const host = url.hostname.toLowerCase();
    const allowedHost =
      host === "api.clockify.me" ||
      /^(euc1|use2|euw2|apse2)\.clockify\.me$/.test(host) ||
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.clockify\.me$/.test(host);
    if (
      url.protocol !== "https:" ||
      !allowedHost ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/api\/v1\/?$/.test(url.pathname)
    )
      throw this.invalid(
        "Clockify API base URL must be a documented HTTPS Clockify /api/v1 origin.",
      );
    return `https://${host}/api/v1`;
  }

  private reportsOrigin(value: string) {
    const regular = new URL(this.regularOrigin(value));
    return regular.hostname === "api.clockify.me"
      ? "https://reports.api.clockify.me/v1"
      : `https://${regular.hostname}/report/v1`;
  }

  private requireBoundUser(credentials: ClockifyCredentials, actual?: string) {
    const expected = credentials.userId?.trim();
    if (!expected || !/^[A-Za-z0-9_-]{1,64}$/.test(expected))
      throw new ClockifyApiError(
        "credential_missing",
        "Clockify user binding is missing; verify the connection again.",
        401,
      );
    if (actual && actual !== expected)
      throw new ClockifyApiError(
        "provider_validation_error",
        "Clockify returned a different user for the stored API key.",
        409,
      );
    return expected;
  }

  private workspace(value: unknown) {
    const item = this.record(value);
    return {
      workspaceId: this.optionalIdentifier(item.id),
      name: this.text(item.name, 500),
      imageUrl: this.safeHttpsUrl(item.imageUrl),
    };
  }

  private project(value: unknown) {
    const item = this.record(value);
    return {
      projectId: this.optionalIdentifier(item.id),
      workspaceId: this.optionalIdentifier(item.workspaceId),
      name: this.text(item.name, 1_000),
      archived: item.archived === true,
      color: this.text(item.color, 100) || null,
      duration: this.text(item.duration, 100) || null,
    };
  }

  private timeEntry(value: unknown) {
    const item = this.record(value);
    const interval = this.record(item.timeInterval);
    return {
      timeEntryId: this.optionalIdentifier(item.id),
      workspaceId: this.optionalIdentifier(item.workspaceId),
      projectId: this.optionalIdentifier(item.projectId),
      taskId: this.optionalIdentifier(item.taskId),
      description: this.text(item.description, 10_000),
      start: this.date(interval.start),
      end: this.date(interval.end),
      duration: this.text(interval.duration, 100) || null,
      type: this.text(item.type, 100) || null,
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new ClockifyApiError(
          "policy_blocked",
          "Clockify request is too deeply nested.",
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
          throw new ClockifyApiError(
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
      throw this.invalid("Clockify query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(key))
        throw this.invalid(`Clockify query parameter ${key} is invalid.`);
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.invalid(`Clockify query ${key} has too many values.`);
      for (const entry of values) {
        if (typeof entry === "object")
          throw this.invalid(`Clockify query ${key} must be scalar.`);
        const text = String(entry);
        if (text.length > 2_000 || /[\r\n]/.test(text))
          throw this.invalid(`Clockify query ${key} is invalid.`);
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
      this.text(item.message, 1_000) ||
      this.text(item.error, 1_000) ||
      this.text(item.description, 1_000) ||
      null
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
      throw this.invalid(`Clockify ${name} must be an RFC3339 timestamp.`);
    return text;
  }

  private identifier(value: unknown, name: string) {
    const text = this.text(value, 64);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(text))
      throw this.invalid(`${name} is invalid.`);
    return text;
  }

  private optionalIdentifier(value: unknown) {
    const text = this.text(value, 64);
    return /^[A-Za-z0-9_-]{1,64}$/.test(text) ? text : null;
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

  private safeHttpsUrl(value: unknown) {
    const text = this.text(value, 2_000);
    try {
      const url = new URL(text);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new ClockifyApiError("provider_validation_error", message, 400);
  }
}
