import { Injectable } from "@nestjs/common";

export type AmplitudeCredentials = {
  apiOrigin: string;
  projectApiKey: string;
  projectSecretKey: string;
};
export class AmplitudeApiError extends Error {
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
  "https://amplitude.com",
  "https://analytics.eu.amplitude.com",
]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class AmplitudeApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: AmplitudeCredentials) {
    await this.send(credentials, "/api/2/events/list");
    return {
      apiOrigin: this.origin(credentials.apiOrigin),
      projectKeyBound: true,
      reachable: true,
    };
  }

  async projectBinding(credentials: AmplitudeCredentials) {
    return this.health(credentials);
  }

  async getDailyUsers(
    credentials: AmplitudeCredentials,
    input: Record<string, unknown>,
  ) {
    const range = this.range(input);
    const mode =
      input.mode === "new" ? "new" : input.mode === "active" ? "active" : null;
    if (!mode)
      throw new AmplitudeApiError(
        "amplitude_user_mode_invalid",
        "Amplitude user mode must be active or new.",
      );
    const query = new URLSearchParams({
      start: range.start,
      end: range.end,
      m: mode,
      i: "1",
    });
    const data = this.object(
      this.object(
        await this.send(credentials, `/api/2/users?${query.toString()}`),
      ).data,
    );
    return {
      mode,
      fromDate: range.fromDate,
      toDate: range.toDate,
      dates: this.scalars(data.xValues, 31),
      values: this.firstNumericSeries(data.series, 31),
    };
  }

  async getAverageSessionLength(
    credentials: AmplitudeCredentials,
    input: Record<string, unknown>,
  ) {
    const range = this.range(input);
    const query = new URLSearchParams({ start: range.start, end: range.end });
    const data = this.object(
      this.object(
        await this.send(
          credentials,
          `/api/2/sessions/average?${query.toString()}`,
        ),
      ).data,
    );
    return {
      fromDate: range.fromDate,
      toDate: range.toDate,
      dates: this.scalars(data.xValues, 31),
      averageSeconds: this.firstNumericSeries(data.series, 31),
    };
  }

  private async send(credentials: AmplitudeCredentials, path: string) {
    const origin = this.origin(credentials.apiOrigin);
    const apiKey = credentials.projectApiKey.trim();
    const secret = credentials.projectSecretKey;
    if (
      apiKey.length < 8 ||
      apiKey.length > 512 ||
      secret.length < 8 ||
      secret.length > 4096 ||
      apiKey.includes(":")
    )
      throw new AmplitudeApiError(
        "amplitude_project_credentials_invalid",
        "Amplitude Project API/Secret Keys are missing or invalid.",
      );
    const url = new URL(path, origin);
    if (
      url.origin !== origin ||
      ![
        "/api/2/events/list",
        "/api/2/users",
        "/api/2/sessions/average",
      ].includes(url.pathname)
    )
      throw new AmplitudeApiError(
        "amplitude_request_invalid",
        "Amplitude request escaped the fixed Dashboard REST API boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:${secret}`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AmplitudeApiError(
        "amplitude_unavailable",
        "Amplitude is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new AmplitudeApiError(
        "amplitude_response_too_large",
        "Amplitude response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new AmplitudeApiError(
        "amplitude_response_invalid",
        "Amplitude returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new AmplitudeApiError(
        response.status === 401
          ? "amplitude_project_credentials_invalid"
          : response.status === 403
            ? "amplitude_permission_denied"
            : response.status === 429
              ? "amplitude_rate_limited"
              : "amplitude_http_error",
        "Amplitude Dashboard REST API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private range(input: Record<string, unknown>) {
    const fromDate = this.date(input.fromDate, "fromDate");
    const toDate = this.date(input.toDate, "toDate");
    const startMs = Date.parse(`${fromDate}T00:00:00Z`);
    const endMs = Date.parse(`${toDate}T00:00:00Z`);
    if (endMs < startMs || endMs - startMs > 30 * 86_400_000)
      throw new AmplitudeApiError(
        "amplitude_date_range_invalid",
        "Amplitude date range must be ordered and contain at most 31 days.",
      );
    return {
      fromDate,
      toDate,
      start: fromDate.replaceAll("-", ""),
      end: toDate.replaceAll("-", ""),
    };
  }
  private date(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !DATE.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    )
      throw new AmplitudeApiError(
        "amplitude_date_invalid",
        `A valid ${label} date in YYYY-MM-DD format is required.`,
      );
    return value;
  }
  private origin(raw: string) {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      throw new AmplitudeApiError(
        "amplitude_api_origin_invalid",
        "Amplitude API origin is invalid.",
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
      throw new AmplitudeApiError(
        "amplitude_api_origin_invalid",
        "Amplitude connection is not bound to the official default or EU Dashboard REST origin.",
      );
    return url.origin;
  }
  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private scalars(value: unknown, limit: number) {
    return Array.isArray(value)
      ? value
          .slice(0, limit)
          .map((item) =>
            typeof item === "string"
              ? item.slice(0, 64)
              : typeof item === "number" && Number.isFinite(item)
                ? item
                : null,
          )
      : [];
  }
  private firstNumericSeries(value: unknown, limit: number) {
    const first =
      Array.isArray(value) && Array.isArray(value[0]) ? value[0] : [];
    return first
      .slice(0, limit)
      .map((item) =>
        typeof item === "number" && Number.isFinite(item) ? item : null,
      );
  }
}
