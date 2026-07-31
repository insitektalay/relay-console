import { Injectable } from "@nestjs/common";

export type ConvertKitApiCredentials = {
  accessToken: string;
  accountId: string;
};

export class ConvertKitApiError extends Error {
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
const API_ORIGIN = "https://api.kit.com";
const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/;

@Injectable()
export class ConvertKitApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ConvertKitApiCredentials) {
    const account = this.account(await this.send(credentials, "/v4/account"));
    this.assertBound(credentials, account.accountId);
    return {
      accountId: credentials.accountId,
      apiOrigin: API_ORIGIN,
      apiVersion: "v4",
      reachable: true,
    };
  }

  async getAccount(credentials: ConvertKitApiCredentials) {
    const account = this.account(await this.send(credentials, "/v4/account"));
    this.assertBound(credentials, account.accountId);
    return { account };
  }

  async listActiveForms(credentials: ConvertKitApiCredentials) {
    const body = this.object(
      await this.send(credentials, "/v4/forms?per_page=20&status=active"),
    );
    return {
      accountId: credentials.accountId,
      forms: this.rows(body.forms)
        .slice(0, 20)
        .map((row) => ({
          formId: this.scalar(row.id),
          name: this.scalar(row.name),
          createdAt: this.scalar(row.created_at),
          type: this.scalar(row.type),
          format: this.scalar(row.format),
          archived: this.scalar(row.archived),
          uid: this.scalar(row.uid),
        })),
    };
  }

  async listRecentBroadcasts(credentials: ConvertKitApiCredentials) {
    const body = this.object(
      await this.send(credentials, "/v4/broadcasts?per_page=20"),
    );
    return {
      accountId: credentials.accountId,
      broadcasts: this.rows(body.broadcasts)
        .slice(0, 20)
        .map((row) => ({
          broadcastId: this.scalar(row.id),
          publicationId: this.scalar(row.publication_id),
          createdAt: this.scalar(row.created_at),
          public: this.scalar(row.public),
          publishedAt: this.scalar(row.published_at),
          sendAt: this.scalar(row.send_at),
        })),
    };
  }

  private async send(credentials: ConvertKitApiCredentials, path: string) {
    if (!ACCOUNT_ID.test(credentials.accountId))
      throw new ConvertKitApiError(
        "convertkit_account_binding_invalid",
        "Kit connection is not bound to a valid account ID.",
      );
    if (!credentials.accessToken.trim())
      throw new ConvertKitApiError(
        "convertkit_token_invalid",
        "Kit connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/v4/"))
      throw new ConvertKitApiError(
        "convertkit_request_invalid",
        "Kit request escaped the fixed API boundary.",
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
      throw new ConvertKitApiError(
        "convertkit_unavailable",
        "Kit is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new ConvertKitApiError(
        "convertkit_response_too_large",
        "Kit response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ConvertKitApiError(
        "convertkit_response_invalid",
        "Kit returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new ConvertKitApiError(
        response.status === 401
          ? "convertkit_token_invalid"
          : response.status === 403
            ? "convertkit_permission_denied"
            : response.status === 429
              ? "convertkit_rate_limited"
              : "convertkit_http_error",
        "Kit API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private account(value: unknown) {
    const body = this.object(value);
    const account = this.object(body.account);
    const timezone = this.object(account.timezone);
    return {
      accountId: this.scalar(account.id),
      name: this.scalar(account.name),
      planType: this.scalar(account.plan_type),
      createdAt: this.scalar(account.created_at),
      timezoneName: this.scalar(timezone.name),
    };
  }

  private assertBound(
    credentials: ConvertKitApiCredentials,
    accountId: string | number | boolean | null,
  ) {
    if (String(accountId ?? "") !== credentials.accountId)
      throw new ConvertKitApiError(
        "convertkit_account_binding_mismatch",
        "Kit account binding changed.",
      );
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
