import { Injectable } from "@nestjs/common";

export type SurveyMonkeyApiCredentials = {
  accessToken: string;
  accessUrl: string;
  userId: string;
};

export class SurveyMonkeyApiError extends Error {
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
const ID = /^[1-9][0-9]{0,31}$/;
const ACCESS_URLS = new Set([
  "https://api.surveymonkey.com",
  "https://api.eu.surveymonkey.com",
  "https://api.surveymonkey.ca",
]);

@Injectable()
export class SurveyMonkeyApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: SurveyMonkeyApiCredentials) {
    const body = this.object(await this.send(credentials, "/v3/users/me"));
    const userId = this.id(body.id);
    if (!userId || userId !== credentials.userId)
      throw new SurveyMonkeyApiError(
        "surveymonkey_user_binding_mismatch",
        "SurveyMonkey user binding changed.",
      );
    return {
      userId,
      accessUrl: credentials.accessUrl,
      apiVersion: "v3",
      reachable: true,
    };
  }

  async listRecentSurveys(credentials: SurveyMonkeyApiCredentials) {
    const query = new URLSearchParams({
      page: "1",
      per_page: "25",
      sort_by: "date_modified",
      sort_order: "DESC",
      include: "response_count,date_created,date_modified,language",
    });
    const body = this.object(
      await this.send(credentials, `/v3/surveys?${query.toString()}`),
    );
    return {
      userId: credentials.userId,
      surveys: this.rows(body.data)
        .slice(0, 25)
        .map((row) => this.survey(row)),
    };
  }

  async listResponses(
    credentials: SurveyMonkeyApiCredentials,
    input: Record<string, unknown>,
  ) {
    const surveyId = this.requiredId(input.surveyId, "survey");
    const body = this.object(
      await this.send(
        credentials,
        `/v3/surveys/${surveyId}/responses?page=1&per_page=25`,
      ),
    );
    return {
      userId: credentials.userId,
      surveyId,
      responses: this.rows(body.data)
        .slice(0, 25)
        .map((row) => this.response(row)),
    };
  }

  async getResponse(
    credentials: SurveyMonkeyApiCredentials,
    input: Record<string, unknown>,
  ) {
    const surveyId = this.requiredId(input.surveyId, "survey");
    const responseId = this.requiredId(input.responseId, "response");
    const body = this.object(
      await this.send(
        credentials,
        `/v3/surveys/${surveyId}/responses/${responseId}`,
      ),
    );
    return {
      userId: credentials.userId,
      surveyId,
      response: this.response(body),
    };
  }

  private async send(credentials: SurveyMonkeyApiCredentials, path: string) {
    const accessUrl = credentials.accessUrl.replace(/\/$/, "");
    if (!ACCESS_URLS.has(accessUrl))
      throw new SurveyMonkeyApiError(
        "surveymonkey_access_url_invalid",
        "SurveyMonkey connection is not bound to an official regional API origin.",
      );
    if (!ID.test(credentials.userId))
      throw new SurveyMonkeyApiError(
        "surveymonkey_user_binding_invalid",
        "SurveyMonkey connection is not bound to a valid user ID.",
      );
    if (!credentials.accessToken.trim())
      throw new SurveyMonkeyApiError(
        "surveymonkey_token_invalid",
        "SurveyMonkey connection token is missing.",
      );
    const url = new URL(path, accessUrl);
    if (url.origin !== accessUrl || !url.pathname.startsWith("/v3/"))
      throw new SurveyMonkeyApiError(
        "surveymonkey_request_invalid",
        "SurveyMonkey request escaped the fixed API boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new SurveyMonkeyApiError(
        "surveymonkey_unavailable",
        "SurveyMonkey is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new SurveyMonkeyApiError(
        "surveymonkey_response_too_large",
        "SurveyMonkey response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new SurveyMonkeyApiError(
        "surveymonkey_response_invalid",
        "SurveyMonkey returned an invalid response.",
      );
    }
    const provider = this.object(body);
    if (!response.ok || provider.status === 1)
      throw new SurveyMonkeyApiError(
        response.status === 401 ||
          provider.errmsg === "Client revoked access grant"
          ? "surveymonkey_token_invalid"
          : response.status === 403
            ? "surveymonkey_permission_denied"
            : response.status === 429
              ? "surveymonkey_rate_limited"
              : "surveymonkey_http_error",
        "SurveyMonkey API request failed.",
        response.status,
        {
          retryAfter: response.headers.get("retry-after"),
          rateLimitRemaining: response.headers.get(
            "x-ratelimit-app-global-minute-remaining",
          ),
        },
      );
    return body;
  }

  private survey(row: Record<string, unknown>) {
    return {
      surveyId: this.scalar(row.id),
      title: this.scalar(row.title),
      nickname: this.scalar(row.nickname),
      language: this.scalar(row.language),
      responseCount: this.scalar(row.response_count),
      createdAt: this.scalar(row.date_created),
      modifiedAt: this.scalar(row.date_modified),
    };
  }

  private response(row: Record<string, unknown>) {
    return {
      responseId: this.scalar(row.id),
      status: this.scalar(row.response_status),
      createdAt: this.scalar(row.date_created),
      modifiedAt: this.scalar(row.date_modified),
    };
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
    return ID.test(id) ? id : null;
  }

  private requiredId(value: unknown, label: string) {
    const id = this.id(value);
    if (!id)
      throw new SurveyMonkeyApiError(
        "surveymonkey_identifier_invalid",
        `An exact positive numeric SurveyMonkey ${label} ID is required.`,
      );
    return id;
  }
}
