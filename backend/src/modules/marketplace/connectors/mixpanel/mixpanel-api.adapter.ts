import { Injectable } from "@nestjs/common";

export type MixpanelCredentials = {
  apiOrigin: string;
  serviceAccountUsername: string;
  serviceAccountSecret: string;
  projectId: string;
};
export class MixpanelApiError extends Error {
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
const API_ORIGINS = new Set([
  "https://mixpanel.com",
  "https://eu.mixpanel.com",
  "https://in.mixpanel.com",
]);
const NUMERIC_ID = /^[1-9][0-9]{0,31}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class MixpanelApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: MixpanelCredentials) {
    const projectId = this.projectId(credentials.projectId);
    await Promise.all([
      this.send(credentials, "GET", "/api/app/me"),
      this.send(
        credentials,
        "GET",
        `/api/app/projects/${projectId}/annotations?fromDate=2000-01-01&toDate=2000-01-01`,
      ),
    ]);
    return {
      apiOrigin: this.origin(credentials.apiOrigin),
      projectId,
      reachable: true,
    };
  }

  async accountBinding(credentials: MixpanelCredentials) {
    return this.health(credentials);
  }

  async listCohorts(credentials: MixpanelCredentials) {
    const projectId = this.projectId(credentials.projectId);
    const body = await this.send(
      credentials,
      "POST",
      `/api/query/cohorts/list?project_id=${projectId}`,
    );
    return {
      projectId,
      cohorts: this.rows(body)
        .slice(0, 25)
        .map((row) => ({
          cohortId: this.id(row.id),
          projectId: this.id(row.project_id),
          count: this.scalar(row.count),
          isVisible: row.is_visible === 1,
          createdAt: this.scalar(row.created),
        })),
    };
  }

  async listAnnotations(
    credentials: MixpanelCredentials,
    input: Record<string, unknown>,
  ) {
    const projectId = this.projectId(credentials.projectId);
    const fromDate = this.date(input.fromDate, "fromDate");
    const toDate = this.date(input.toDate, "toDate");
    const start = Date.parse(`${fromDate}T00:00:00Z`);
    const end = Date.parse(`${toDate}T00:00:00Z`);
    if (end < start || end - start > 31 * 86_400_000)
      throw new MixpanelApiError(
        "mixpanel_date_range_invalid",
        "Mixpanel annotation date range must be ordered and no longer than 31 days.",
      );
    const query = new URLSearchParams({ fromDate, toDate });
    const body = this.object(
      await this.send(
        credentials,
        "GET",
        `/api/app/projects/${projectId}/annotations?${query.toString()}`,
      ),
    );
    return {
      projectId,
      fromDate,
      toDate,
      annotations: this.rows(body.results)
        .slice(0, 25)
        .map((row) => ({
          annotationId: this.id(row.id),
          date: this.scalar(row.date),
        })),
    };
  }

  private async send(
    credentials: MixpanelCredentials,
    method: "GET" | "POST",
    path: string,
  ) {
    const origin = this.origin(credentials.apiOrigin);
    const username = credentials.serviceAccountUsername.trim();
    const secret = credentials.serviceAccountSecret;
    if (
      !username ||
      username.length > 512 ||
      secret.length < 8 ||
      secret.length > 4096 ||
      username.includes(":")
    )
      throw new MixpanelApiError(
        "mixpanel_service_account_invalid",
        "Mixpanel Service Account credentials are missing or invalid.",
      );
    const url = new URL(path, origin);
    const allowed =
      url.pathname === "/api/app/me" ||
      url.pathname === "/api/query/cohorts/list" ||
      /^\/api\/app\/projects\/[1-9][0-9]{0,31}\/annotations$/.test(
        url.pathname,
      );
    if (url.origin !== origin || !allowed)
      throw new MixpanelApiError(
        "mixpanel_request_invalid",
        "Mixpanel request escaped the fixed API boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new MixpanelApiError(
        "mixpanel_unavailable",
        "Mixpanel is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new MixpanelApiError(
        "mixpanel_response_too_large",
        "Mixpanel response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MixpanelApiError(
        "mixpanel_response_invalid",
        "Mixpanel returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new MixpanelApiError(
        response.status === 401
          ? "mixpanel_service_account_invalid"
          : response.status === 403
            ? "mixpanel_permission_denied"
            : response.status === 429
              ? "mixpanel_rate_limited"
              : "mixpanel_http_error",
        "Mixpanel API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private origin(raw: string) {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      throw new MixpanelApiError(
        "mixpanel_api_origin_invalid",
        "Mixpanel API origin is invalid.",
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
    )
      throw new MixpanelApiError(
        "mixpanel_api_origin_invalid",
        "Mixpanel connection is not bound to an official US, EU, or India API origin.",
      );
    return url.origin;
  }
  private projectId(value: unknown) {
    const id = typeof value === "string" ? value : String(value ?? "");
    if (!NUMERIC_ID.test(id))
      throw new MixpanelApiError(
        "mixpanel_project_identifier_invalid",
        "A valid exact numeric Mixpanel Project ID is required.",
      );
    return id;
  }
  private date(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !DATE.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    )
      throw new MixpanelApiError(
        "mixpanel_date_invalid",
        `A valid ${label} date in YYYY-MM-DD format is required.`,
      );
    return value;
  }
  private rows(value: unknown) {
    return Array.isArray(value) ? value.map((item) => this.object(item)) : [];
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
  private id(value: unknown) {
    const id = typeof value === "string" ? value : String(value ?? "");
    return NUMERIC_ID.test(id) ? id : null;
  }
}
