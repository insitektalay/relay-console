import { Injectable } from "@nestjs/common";

export type FilloutApiCredentials = {
  accessToken: string;
  baseUrl: string;
};

export class FilloutApiError extends Error {
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
const FORM_ID = /^[A-Za-z0-9_-]{1,128}$/;
const BASE_URLS = new Set([
  "https://api.fillout.com",
  "https://eu-api.fillout.com",
]);

@Injectable()
export class FilloutApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: FilloutApiCredentials) {
    const forms = await this.listForms(credentials);
    return {
      baseUrl: credentials.baseUrl,
      visibleFormCount: forms.forms.length,
      reachable: true,
    };
  }

  async listForms(credentials: FilloutApiCredentials) {
    const body = await this.send(credentials, "/v1/api/forms");
    const rows = Array.isArray(body)
      ? body
      : this.rows(this.object(body).forms);
    return {
      forms: rows.slice(0, 25).map((row) => ({
        formId: this.scalar(row.formId ?? row.id),
        name: this.scalar(row.name),
      })),
    };
  }

  async getFormMetadata(
    credentials: FilloutApiCredentials,
    input: Record<string, unknown>,
  ) {
    const formId = this.requiredFormId(input.formId);
    const form = this.object(
      await this.send(credentials, `/v1/api/forms/${formId}`),
    );
    const quiz = this.object(form.quiz);
    return {
      form: {
        formId: this.scalar(form.id ?? form.formId),
        name: this.scalar(form.name),
        questionCount: this.count(form.questions),
        calculationCount: this.count(form.calculations),
        urlParameterCount: this.count(form.urlParameters),
        schedulingFieldCount: this.count(form.scheduling),
        paymentFieldCount: this.count(form.payments),
        quizEnabled: quiz.enabled === true,
      },
    };
  }

  async listRecentSubmissions(
    credentials: FilloutApiCredentials,
    input: Record<string, unknown>,
  ) {
    const formId = this.requiredFormId(input.formId);
    const query = new URLSearchParams({
      limit: "25",
      offset: "0",
      status: "finished",
      includeEditLink: "false",
      includePreview: "false",
      sort: "desc",
    });
    const body = this.object(
      await this.send(
        credentials,
        `/v1/api/forms/${formId}/submissions?${query.toString()}`,
      ),
    );
    return {
      formId,
      submissions: this.rows(body.responses)
        .slice(0, 25)
        .map((row) => ({
          submissionId: this.scalar(row.submissionId),
          submissionTime: this.scalar(row.submissionTime),
          lastUpdatedAt: this.scalar(row.lastUpdatedAt),
        })),
    };
  }

  private async send(credentials: FilloutApiCredentials, path: string) {
    const baseUrl = credentials.baseUrl.replace(/\/$/, "");
    if (!BASE_URLS.has(baseUrl))
      throw new FilloutApiError(
        "fillout_base_url_invalid",
        "Fillout connection is not bound to an official supported API origin.",
      );
    if (!credentials.accessToken.trim())
      throw new FilloutApiError(
        "fillout_token_invalid",
        "Fillout connection token is missing.",
      );
    const url = new URL(path, baseUrl);
    if (url.origin !== baseUrl || !url.pathname.startsWith("/v1/api/"))
      throw new FilloutApiError(
        "fillout_request_invalid",
        "Fillout request escaped the fixed API boundary.",
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
      throw new FilloutApiError(
        "fillout_unavailable",
        "Fillout is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new FilloutApiError(
        "fillout_response_too_large",
        "Fillout response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new FilloutApiError(
        "fillout_response_invalid",
        "Fillout returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new FilloutApiError(
        response.status === 401
          ? "fillout_token_invalid"
          : response.status === 403
            ? "fillout_permission_denied"
            : response.status === 429
              ? "fillout_rate_limited"
              : "fillout_http_error",
        "Fillout API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private requiredFormId(value: unknown) {
    if (typeof value !== "string" || !FORM_ID.test(value))
      throw new FilloutApiError(
        "fillout_form_identifier_invalid",
        "An exact bounded URL-safe Fillout Form ID is required.",
      );
    return value;
  }

  private count(value: unknown) {
    return Array.isArray(value) ? value.length : 0;
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
}
