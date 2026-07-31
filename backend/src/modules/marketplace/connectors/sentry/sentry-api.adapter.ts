import { safeConnectorFetch } from "../safe-connector-fetch";
export type SentryCredentials = {
  organization: string;
  accessToken: string;
};

export type SentryIssueUpdate = {
  status?:
    | "resolved"
    | "unresolved"
    | "ignored"
    | "resolvedInNextRelease"
    | "muted";
  substatus?:
    | "archived_until_escalating"
    | "archived_until_condition_met"
    | "archived_forever"
    | "escalating";
  priority?: "high" | "medium" | "low";
};

type RequestFn = (
  url: string,
  init: RequestInit,
) => Promise<{ status: number; text(): Promise<string> }>;

export class SentryApiError extends Error {
  constructor(
    readonly code:
      | "sentry_access_token_invalid"
      | "sentry_permission_denied"
      | "sentry_not_found"
      | "sentry_rate_limited"
      | "sentry_provider_unavailable"
      | "sentry_invalid_response"
      | "sentry_validation_error",
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const text = (value: unknown, max = 500): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const integer = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

export class SentryApiAdapter {
  constructor(
    private readonly request: RequestFn = async (url, init) => {
      const response = await safeConnectorFetch(url, init);
      return response;
    },
  ) {}

  async health(credentials: SentryCredentials) {
    const projects = await this.getList(
      credentials,
      `/api/0/organizations/${this.organization(credentials)}/projects/?per_page=1`,
    );
    return {
      tokenValid: true,
      organization: credentials.organization,
      projectAccess: projects.length > 0,
    };
  }

  async listProjects(credentials: SentryCredentials) {
    const rows = await this.getList(
      credentials,
      `/api/0/organizations/${this.organization(credentials)}/projects/?per_page=25`,
    );
    return rows.slice(0, 25).map((value) => this.project(value));
  }

  async searchIssues(
    credentials: SentryCredentials,
    input: {
      project?: string;
      environment?: string;
      query?: string;
      statsPeriod?: "24h" | "7d" | "14d";
      sort?: "date" | "new" | "freq" | "user";
      limit?: number;
    },
  ) {
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
    const params = new URLSearchParams({
      limit: String(limit),
      statsPeriod: input.statsPeriod ?? "24h",
      sort: input.sort ?? "date",
      query: text(input.query, 200) ?? "is:unresolved",
    });
    if (input.project)
      params.set("project", this.slug(input.project, "project"));
    if (input.environment)
      params.set(
        "environment",
        this.safeFilter(input.environment, "environment"),
      );
    const rows = await this.getList(
      credentials,
      `/api/0/organizations/${this.organization(credentials)}/issues/?${params.toString()}`,
    );
    return rows.slice(0, limit).map((value) => this.issue(value));
  }

  async getIssue(credentials: SentryCredentials, issueId: string) {
    const value = await this.getObject(
      credentials,
      `/api/0/organizations/${this.organization(credentials)}/issues/${this.id(issueId, "issue")}/`,
    );
    return this.issue(value, true);
  }

  async getEvent(
    credentials: SentryCredentials,
    projectSlug: string,
    eventId: string,
  ) {
    const value = await this.getObject(
      credentials,
      `/api/0/projects/${this.organization(credentials)}/${this.slug(projectSlug, "project")}/events/${this.eventId(eventId)}/`,
    );
    return this.event(value);
  }

  async updateIssue(
    credentials: SentryCredentials,
    issueId: string,
    update: SentryIssueUpdate,
  ) {
    if (!Object.keys(update).length)
      throw new SentryApiError(
        "sentry_validation_error",
        "At least one issue workflow field is required.",
      );
    const value = await this.send(
      credentials,
      `/api/0/organizations/${this.organization(credentials)}/issues/${this.id(issueId, "issue")}/`,
      "PUT",
      update,
    );
    return this.issue(value, true);
  }

  private project(value: unknown) {
    const row = object(value) ?? {};
    return {
      id: text(row.id, 128),
      slug: text(row.slug, 128),
      name: text(row.name, 200),
      platform: text(row.platform, 100),
      status: text(row.status, 50),
      dateCreated: text(row.dateCreated, 50),
    };
  }

  private issue(value: unknown, includeLatestEvent = false) {
    const row = object(value) ?? {};
    const project = object(row.project) ?? {};
    const metadata = object(row.metadata) ?? {};
    const latestEvent = includeLatestEvent ? object(row.latestEvent) : null;
    return {
      id: text(row.id, 128),
      shortId: text(row.shortId, 100),
      title: text(row.title, 500),
      culprit: text(row.culprit, 500),
      status: text(row.status, 50),
      substatus: text(row.substatus, 80),
      priority: text(row.priority, 50),
      level: text(row.level, 50),
      count: integer(row.count),
      userCount: integer(row.userCount),
      firstSeen: text(row.firstSeen, 50),
      lastSeen: text(row.lastSeen, 50),
      permalink: this.permalink(row.permalink),
      project: {
        id: text(project.id, 128),
        slug: text(project.slug, 128),
        name: text(project.name, 200),
      },
      metadata: {
        type: text(metadata.type, 200),
        value: text(metadata.value, 500),
        filename: text(metadata.filename, 300),
        function: text(metadata.function, 300),
      },
      ...(latestEvent ? { latestEvent: this.event(latestEvent) } : {}),
    };
  }

  private event(value: unknown) {
    const row = object(value) ?? {};
    const release = object(row.release) ?? {};
    const entries = array(row.entries).map(object).filter(Boolean) as Record<
      string,
      unknown
    >[];
    const exceptions = entries
      .filter((entry) => entry.type === "exception")
      .flatMap((entry) => array(object(entry.data)?.values))
      .slice(0, 5)
      .map((exception) => {
        const item = object(exception) ?? {};
        const stacktrace = object(item.stacktrace) ?? {};
        return {
          type: text(item.type, 200),
          value: text(item.value, 1000),
          frames: array(stacktrace.frames)
            .slice(-12)
            .map((frame) => {
              const data = object(frame) ?? {};
              return {
                filename: text(data.filename, 300),
                function: text(data.function, 300),
                lineNo: integer(data.lineNo),
                colNo: integer(data.colNo),
                inApp: typeof data.inApp === "boolean" ? data.inApp : null,
              };
            }),
        };
      });
    const allowedTags = new Set([
      "environment",
      "release",
      "level",
      "transaction",
      "runtime",
    ]);
    const tags = array(row.tags)
      .map(object)
      .filter((tag): tag is Record<string, unknown> => {
        const key = text(tag?.key, 80);
        return Boolean(key && allowedTags.has(key));
      })
      .slice(0, 10)
      .map((tag) => ({ key: text(tag.key, 80), value: text(tag.value, 300) }));
    return {
      id: text(row.id ?? row.eventID, 128),
      title: text(row.title, 500),
      message: text(row.message, 1000),
      platform: text(row.platform, 100),
      dateCreated: text(row.dateCreated ?? row.dateReceived, 50),
      environment: text(row.environment, 100),
      release: text(release.version ?? row.release, 200),
      tags,
      exceptions,
    };
  }

  private async getList(credentials: SentryCredentials, path: string) {
    const value = await this.send(credentials, path, "GET");
    if (!Array.isArray(value))
      throw new SentryApiError(
        "sentry_invalid_response",
        "Sentry returned an unexpected list response.",
      );
    return value;
  }

  private async getObject(credentials: SentryCredentials, path: string) {
    const value = await this.send(credentials, path, "GET");
    const result = object(value);
    if (!result)
      throw new SentryApiError(
        "sentry_invalid_response",
        "Sentry returned an unexpected object response.",
      );
    return result;
  }

  private async send(
    credentials: SentryCredentials,
    path: string,
    method: "GET" | "PUT",
    body?: unknown,
  ): Promise<unknown> {
    if (!path.startsWith("/api/0/") || path.includes(".."))
      throw new SentryApiError(
        "sentry_validation_error",
        "Sentry request path is not allowed.",
      );
    const token = text(credentials.accessToken, 4096);
    if (!token)
      throw new SentryApiError(
        "sentry_access_token_invalid",
        "Sentry OAuth access is missing.",
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Awaited<ReturnType<RequestFn>>;
    try {
      response = await this.request(`https://sentry.io${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw new SentryApiError(
        "sentry_provider_unavailable",
        "Sentry is temporarily unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new SentryApiError(
        "sentry_invalid_response",
        "Sentry response exceeded the safe size limit.",
      );
    if (response.status === 401)
      throw new SentryApiError(
        "sentry_access_token_invalid",
        "Sentry OAuth access is invalid or expired.",
        response.status,
      );
    if (response.status === 403)
      throw new SentryApiError(
        "sentry_permission_denied",
        "Sentry denied the requested organization, project, or scope.",
        response.status,
      );
    if (response.status === 404)
      throw new SentryApiError(
        "sentry_not_found",
        "The requested Sentry resource was not found.",
        response.status,
      );
    if (response.status === 429)
      throw new SentryApiError(
        "sentry_rate_limited",
        "Sentry rate limited the request.",
        response.status,
      );
    if (response.status < 200 || response.status >= 300)
      throw new SentryApiError(
        "sentry_provider_unavailable",
        "Sentry could not complete the request.",
        response.status,
      );
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      throw new SentryApiError(
        "sentry_invalid_response",
        "Sentry returned invalid JSON.",
      );
    }
  }

  private organization(credentials: SentryCredentials) {
    return this.slug(credentials.organization, "organization");
  }

  private slug(value: string, label: string) {
    const normalized = text(value, 128);
    if (!normalized || !/^[A-Za-z0-9_-]+$/.test(normalized))
      throw new SentryApiError(
        "sentry_validation_error",
        `Sentry ${label} slug is invalid.`,
      );
    return encodeURIComponent(normalized);
  }

  private id(value: string, label: string) {
    const normalized = text(value, 128);
    if (!normalized || !/^[0-9]+$/.test(normalized))
      throw new SentryApiError(
        "sentry_validation_error",
        `Sentry ${label} ID is invalid.`,
      );
    return normalized;
  }

  private eventId(value: string) {
    const normalized = text(value, 128);
    if (!normalized || !/^[A-Fa-f0-9-]+$/.test(normalized))
      throw new SentryApiError(
        "sentry_validation_error",
        "Sentry Event ID is invalid.",
      );
    return normalized;
  }

  private safeFilter(value: string, label: string) {
    const normalized = text(value, 100);
    if (!normalized || !/^[A-Za-z0-9 _.-]+$/.test(normalized))
      throw new SentryApiError(
        "sentry_validation_error",
        `Sentry ${label} filter is invalid.`,
      );
    return normalized;
  }

  private permalink(value: unknown) {
    const candidate = text(value, 1000);
    if (!candidate) return null;
    try {
      const url = new URL(candidate);
      return url.protocol === "https:" && url.hostname === "sentry.io"
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
}
