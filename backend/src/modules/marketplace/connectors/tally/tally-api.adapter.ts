import { Injectable } from "@nestjs/common";

export type TallyCredentials = { apiKey: string };

export class TallyApiError extends Error {
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
const API_ORIGIN = "https://api.tally.so";
const API_VERSION = "2025-02-01";

@Injectable()
export class TallyApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: TallyCredentials) {
    const user = this.object(await this.send(credentials, "/users/me"));
    const userId = this.boundedString(user.id);
    if (!userId)
      throw new TallyApiError(
        "tally_user_binding_invalid",
        "Tally API key is not bound to a valid current user.",
      );
    return {
      userId,
      organizationId: this.boundedString(user.organizationId),
      displayName: this.boundedString(user.fullName),
      subscriptionPlan: this.boundedString(user.subscriptionPlan),
      apiVersion: API_VERSION,
      reachable: true,
    };
  }

  async listForms(credentials: TallyCredentials) {
    const body = this.object(
      await this.send(credentials, "/forms?page=1&limit=25"),
    );
    return {
      forms: this.rows(body.items)
        .slice(0, 25)
        .map((row) => this.form(row)),
    };
  }

  async getForm(credentials: TallyCredentials, input: Record<string, unknown>) {
    const formId = this.requiredFormId(input.formId);
    return {
      form: this.form(
        this.object(await this.send(credentials, `/forms/${formId}`)),
      ),
    };
  }

  async listSubmissions(
    credentials: TallyCredentials,
    input: Record<string, unknown>,
  ) {
    const formId = this.requiredFormId(input.formId);
    const body = this.object(
      await this.send(
        credentials,
        `/forms/${formId}/submissions?page=1&limit=25&filter=completed`,
      ),
    );
    return {
      formId,
      submissions: this.rows(body.submissions)
        .slice(0, 25)
        .map((row) => ({
          submissionId: this.scalar(row.id),
          formId: this.scalar(row.formId),
          isCompleted: row.isCompleted === true,
          submittedAt: this.scalar(row.submittedAt),
          createdAt: this.scalar(row.createdAt),
          updatedAt: this.scalar(row.updatedAt),
        })),
    };
  }

  private async send(credentials: TallyCredentials, path: string) {
    if (
      !credentials.apiKey.startsWith("tly-") ||
      credentials.apiKey.length < 8 ||
      credentials.apiKey.length > 512
    )
      throw new TallyApiError(
        "tally_api_key_invalid",
        "A valid Tally tly- API key is required.",
      );
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/"))
      throw new TallyApiError(
        "tally_request_invalid",
        "Tally request escaped the fixed API boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "tally-version": API_VERSION,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new TallyApiError(
        "tally_unavailable",
        "Tally is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new TallyApiError(
        "tally_response_too_large",
        "Tally response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new TallyApiError(
        "tally_response_invalid",
        "Tally returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new TallyApiError(
        response.status === 401
          ? "tally_api_key_invalid"
          : response.status === 403
            ? "tally_permission_denied"
            : response.status === 429
              ? "tally_rate_limited"
              : response.status === 404
                ? "tally_not_found"
                : "tally_http_error",
        "Tally API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private form(row: Record<string, unknown>) {
    return {
      formId: this.scalar(row.id),
      name: this.scalar(row.name),
      workspaceId: this.scalar(row.workspaceId),
      status: this.scalar(row.status),
      numberOfSubmissions: this.scalar(row.numberOfSubmissions),
      isClosed: this.scalar(row.isClosed),
      createdAt: this.scalar(row.createdAt),
      updatedAt: this.scalar(row.updatedAt),
    };
  }

  private requiredFormId(value: unknown) {
    if (typeof value !== "string" || !FORM_ID.test(value))
      throw new TallyApiError(
        "tally_form_identifier_invalid",
        "An exact bounded URL-safe Tally Form ID is required.",
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

  private boundedString(value: unknown) {
    return typeof value === "string" && value.trim()
      ? value.slice(0, 512)
      : null;
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
}
