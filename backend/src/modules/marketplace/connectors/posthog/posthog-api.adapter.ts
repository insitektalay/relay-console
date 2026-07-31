import { Injectable } from "@nestjs/common";

export type PostHogCredentials = {
  apiOrigin: string;
  organizationId: string;
  projectId: string;
  accessToken: string;
};

export class PostHogApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
type SchemaKind = "event" | "property";

const API_ORIGINS = new Set([
  "https://us.posthog.com",
  "https://eu.posthog.com",
]);
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;
const PROJECT_ID = /^\d{1,18}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class PostHogApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: PostHogCredentials) {
    const ids = this.ids(credentials);
    const project = this.object(
      await this.send(
        credentials,
        `/api/organizations/${encodeURIComponent(ids.organizationId)}/projects/${encodeURIComponent(ids.projectId)}/`,
        "GET",
      ),
    );
    return {
      apiOrigin: this.origin(credentials.apiOrigin),
      organizationId: ids.organizationId,
      projectId: ids.projectId,
      projectName: this.text(project.name, 160),
      reachable: true,
    };
  }

  async listProjects(credentials: PostHogCredentials) {
    const ids = this.ids(credentials);
    const query = new URLSearchParams({ limit: "25" });
    const body = this.object(
      await this.send(
        credentials,
        `/api/organizations/${encodeURIComponent(ids.organizationId)}/projects/?${query.toString()}`,
        "GET",
      ),
    );
    return {
      apiOrigin: this.origin(credentials.apiOrigin),
      organizationId: ids.organizationId,
      selectedProjectId: ids.projectId,
      projects: this.array(body.results)
        .slice(0, 25)
        .map((value) => {
          const row = this.object(value);
          return {
            id: this.identifier(row.id),
            name: this.text(row.name, 160),
            selected: String(row.id) === ids.projectId,
          };
        }),
    };
  }

  async listDashboards(
    credentials: PostHogCredentials,
    input: Record<string, unknown>,
  ) {
    const ids = this.ids(credentials);
    const query = this.listQuery(input);
    const body = this.object(
      await this.send(
        credentials,
        `/api/projects/${encodeURIComponent(ids.projectId)}/dashboards/?${query.toString()}`,
        "GET",
      ),
    );
    return {
      projectId: ids.projectId,
      dashboards: this.array(body.results)
        .slice(0, 25)
        .map((value) => this.dashboardSummary(value)),
    };
  }

  async getDashboard(
    credentials: PostHogCredentials,
    input: Record<string, unknown>,
  ) {
    const ids = this.ids(credentials);
    const dashboardId = this.resourceId(input.dashboardId, "dashboardId");
    const body = await this.send(
      credentials,
      `/api/projects/${encodeURIComponent(ids.projectId)}/dashboards/${encodeURIComponent(dashboardId)}/`,
      "GET",
    );
    return { projectId: ids.projectId, dashboard: this.dashboardSummary(body) };
  }

  async listInsights(
    credentials: PostHogCredentials,
    input: Record<string, unknown>,
  ) {
    const ids = this.ids(credentials);
    const query = this.listQuery(input);
    const body = this.object(
      await this.send(
        credentials,
        `/api/projects/${encodeURIComponent(ids.projectId)}/insights/?${query.toString()}`,
        "GET",
      ),
    );
    return {
      projectId: ids.projectId,
      insights: this.array(body.results)
        .slice(0, 25)
        .map((value) => this.insightSummary(value)),
    };
  }

  async getInsight(
    credentials: PostHogCredentials,
    input: Record<string, unknown>,
  ) {
    const ids = this.ids(credentials);
    const insightId = this.resourceId(input.insightId, "insightId");
    const body = await this.send(
      credentials,
      `/api/projects/${encodeURIComponent(ids.projectId)}/insights/${encodeURIComponent(insightId)}/`,
      "GET",
    );
    return { projectId: ids.projectId, insight: this.insightSummary(body) };
  }

  async runBoundedTrend(
    credentials: PostHogCredentials,
    input: Record<string, unknown>,
  ) {
    const ids = this.ids(credentials);
    const range = this.range(input);
    const event = this.requiredText(input.event, "event", 200);
    const body = this.object(
      await this.send(
        credentials,
        `/api/projects/${encodeURIComponent(ids.projectId)}/query/`,
        "POST",
        {
          query: {
            kind: "TrendsQuery",
            dateRange: {
              date_from: range.fromDate,
              date_to: range.toDate,
            },
            interval: "day",
            series: [{ kind: "EventsNode", event, math: "total" }],
          },
        },
      ),
    );
    const first = this.object(this.array(body.results)[0]);
    return {
      projectId: ids.projectId,
      event,
      fromDate: range.fromDate,
      toDate: range.toDate,
      dates: this.stringArray(first.days, 31, 32),
      labels: this.stringArray(first.labels, 31, 64),
      values: this.numberArray(first.data, 31),
    };
  }

  async readSchema(
    credentials: PostHogCredentials,
    input: Record<string, unknown>,
  ) {
    const ids = this.ids(credentials);
    const kind = this.schemaKind(input.kind);
    const query = this.listQuery(input);
    const path =
      kind === "event"
        ? `/api/projects/${encodeURIComponent(ids.projectId)}/event_definitions/?${query.toString()}`
        : `/api/projects/${encodeURIComponent(ids.projectId)}/property_definitions/?${query.toString()}`;
    const body = this.object(await this.send(credentials, path, "GET"));
    return {
      projectId: ids.projectId,
      kind,
      definitions: this.array(body.results)
        .slice(0, 25)
        .map((value) => {
          const row = this.object(value);
          return {
            id: this.identifier(row.id),
            name: this.text(row.name, 200),
            description: this.text(row.description, 500),
            propertyType:
              kind === "property" ? this.text(row.property_type, 64) : null,
            lastSeenAt:
              kind === "event" ? this.text(row.last_seen_at, 64) : null,
            volume30Day:
              kind === "event" &&
              typeof row.volume_30_day === "number" &&
              Number.isFinite(row.volume_30_day)
                ? row.volume_30_day
                : null,
          };
        }),
    };
  }

  private async send(
    credentials: PostHogCredentials,
    path: string,
    method: "GET" | "POST",
    body?: Record<string, unknown>,
  ) {
    const origin = this.origin(credentials.apiOrigin);
    const token = credentials.accessToken.trim();
    if (token.length < 8 || token.length > 4096) {
      throw new PostHogApiError(
        "posthog_access_token_invalid",
        "PostHog OAuth access token is missing or invalid.",
      );
    }
    const url = new URL(path, origin);
    if (url.origin !== origin || !this.allowedPath(url.pathname)) {
      throw new PostHogApiError(
        "posthog_request_invalid",
        "PostHog request escaped the fixed REST boundary.",
      );
    }
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new PostHogApiError(
        "posthog_unavailable",
        "PostHog is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000) {
      throw new PostHogApiError(
        "posthog_response_too_large",
        "PostHog response exceeded the safe size limit.",
      );
    }
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      throw new PostHogApiError(
        "posthog_response_invalid",
        "PostHog returned an invalid response.",
      );
    }
    if (!response.ok) {
      throw new PostHogApiError(
        response.status === 401
          ? "posthog_access_token_invalid"
          : response.status === 403
            ? "posthog_permission_denied"
            : response.status === 404
              ? "posthog_project_not_found"
              : response.status === 429
                ? "posthog_rate_limited"
                : response.status === 400
                  ? "posthog_request_invalid"
                  : "posthog_http_error",
        "PostHog REST API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    }
    return parsed;
  }

  private allowedPath(pathname: string) {
    return (
      /^\/api\/organizations\/[A-Za-z0-9_-]+\/projects\/?$/.test(pathname) ||
      /^\/api\/organizations\/[A-Za-z0-9_-]+\/projects\/\d+\/$/.test(
        pathname,
      ) ||
      /^\/api\/projects\/\d+\/(dashboards|insights)\/$/.test(pathname) ||
      /^\/api\/projects\/\d+\/(dashboards|insights)\/[A-Za-z0-9_-]+\/$/.test(
        pathname,
      ) ||
      /^\/api\/projects\/\d+\/(query|event_definitions|property_definitions)\/$/.test(
        pathname,
      )
    );
  }

  private ids(credentials: PostHogCredentials) {
    const organizationId = credentials.organizationId.trim();
    const projectId = credentials.projectId.trim();
    if (!IDENTIFIER.test(organizationId)) {
      throw new PostHogApiError(
        "posthog_organization_id_invalid",
        "PostHog Organization ID is missing or invalid.",
      );
    }
    if (!PROJECT_ID.test(projectId)) {
      throw new PostHogApiError(
        "posthog_project_id_invalid",
        "PostHog Project/Environment ID is missing or invalid.",
      );
    }
    return { organizationId, projectId };
  }

  private listQuery(input: Record<string, unknown>) {
    const query = new URLSearchParams({ limit: "25" });
    if (input.search !== undefined) {
      query.set("search", this.requiredText(input.search, "search", 100));
    }
    return query;
  }

  private range(input: Record<string, unknown>) {
    const fromDate = this.date(input.fromDate, "fromDate");
    const toDate = this.date(input.toDate, "toDate");
    const start = Date.parse(`${fromDate}T00:00:00Z`);
    const end = Date.parse(`${toDate}T00:00:00Z`);
    if (end < start || end - start > 30 * 86_400_000) {
      throw new PostHogApiError(
        "posthog_date_range_invalid",
        "PostHog date range must be ordered and contain at most 31 days.",
      );
    }
    return { fromDate, toDate };
  }

  private date(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !DATE.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    ) {
      throw new PostHogApiError(
        "posthog_date_invalid",
        `A valid ${label} date in YYYY-MM-DD format is required.`,
      );
    }
    return value;
  }

  private resourceId(value: unknown, label: string) {
    const id = this.requiredText(value, label, 128);
    if (!IDENTIFIER.test(id)) {
      throw new PostHogApiError(
        "posthog_resource_id_invalid",
        `PostHog ${label} is invalid.`,
      );
    }
    return id;
  }

  private schemaKind(value: unknown): SchemaKind {
    if (value === "event" || value === "property") return value;
    throw new PostHogApiError(
      "posthog_schema_kind_invalid",
      "PostHog schema kind must be event or property.",
    );
  }

  private origin(raw: string) {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      throw new PostHogApiError(
        "posthog_api_origin_invalid",
        "PostHog API origin is invalid.",
      );
    }
    if (
      !API_ORIGINS.has(url.origin) ||
      url.protocol !== "https:" ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new PostHogApiError(
        "posthog_api_origin_invalid",
        "PostHog connection is not bound to the US or EU Cloud API origin.",
      );
    }
    return url.origin;
  }

  private dashboardSummary(value: unknown) {
    const row = this.object(value);
    return {
      id: this.identifier(row.id),
      name: this.text(row.name, 200),
      description: this.text(row.description, 500),
      createdAt: this.text(row.created_at, 64),
      updatedAt: this.text(row.updated_at, 64),
      tileCount: this.array(row.tiles).slice(0, 100).length,
    };
  }

  private insightSummary(value: unknown) {
    const row = this.object(value);
    const query = this.object(row.query);
    return {
      id: this.identifier(row.id),
      shortId: this.text(row.short_id, 128),
      name: this.text(row.name, 200),
      description: this.text(row.description, 500),
      queryKind: this.text(query.kind, 80),
      createdAt: this.text(row.created_at, 64),
      updatedAt: this.text(row.updated_at, 64),
    };
  }

  private requiredText(value: unknown, label: string, max: number) {
    if (typeof value !== "string") {
      throw new PostHogApiError(
        "posthog_input_invalid",
        `PostHog ${label} is required.`,
      );
    }
    const text = value.trim();
    if (!text || text.length > max) {
      throw new PostHogApiError(
        "posthog_input_invalid",
        `PostHog ${label} is invalid.`,
      );
    }
    return text;
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private identifier(value: unknown) {
    return typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value))
      ? String(value).slice(0, 128)
      : null;
  }

  private stringArray(value: unknown, limit: number, max: number) {
    return this.array(value)
      .slice(0, limit)
      .map((item) => (typeof item === "string" ? item.slice(0, max) : null));
  }

  private numberArray(value: unknown, limit: number) {
    return this.array(value)
      .slice(0, limit)
      .map((item) =>
        typeof item === "number" && Number.isFinite(item) ? item : null,
      );
  }
}
