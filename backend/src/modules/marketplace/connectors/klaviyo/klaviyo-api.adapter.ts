import { Injectable } from "@nestjs/common";
import { KLAVIYO_API_REVISION } from "./klaviyo.connector";

export type KlaviyoApiCredentials = {
  accessToken: string;
  accountId: string;
};

export class KlaviyoApiError extends Error {
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
const API_ORIGIN = "https://a.klaviyo.com";
const ID = /^[A-Za-z0-9_-]{1,64}$/;

@Injectable()
export class KlaviyoApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: KlaviyoApiCredentials) {
    const account = this.account(
      this.first(
        await this.send(
          credentials,
          "/api/accounts?fields%5Baccount%5D=name%2Ctimezone%2Ccurrency",
        ),
      ),
    );
    if (account.accountId !== credentials.accountId)
      throw new KlaviyoApiError(
        "klaviyo_account_binding_mismatch",
        "Klaviyo Account binding changed.",
      );
    return {
      accountId: credentials.accountId,
      apiOrigin: API_ORIGIN,
      apiRevision: KLAVIYO_API_REVISION,
      reachable: true,
    };
  }

  async getAccount(credentials: KlaviyoApiCredentials) {
    const account = this.account(
      this.first(
        await this.send(
          credentials,
          "/api/accounts?fields%5Baccount%5D=name%2Ctimezone%2Ccurrency",
        ),
      ),
    );
    if (account.accountId !== credentials.accountId)
      throw new KlaviyoApiError(
        "klaviyo_account_binding_mismatch",
        "Klaviyo Account binding changed.",
      );
    return { account };
  }

  async listRecentLists(credentials: KlaviyoApiCredentials) {
    const query = new URLSearchParams({
      "page[size]": "10",
      sort: "-updated",
      "fields[list]": "name,created,updated,opt_in_process",
    });
    const body = this.object(
      await this.send(credentials, `/api/lists?${query.toString()}`),
    );
    return {
      accountId: credentials.accountId,
      lists: this.rows(body.data)
        .slice(0, 10)
        .map((row) => this.list(row)),
    };
  }

  async listRecentEmailCampaigns(credentials: KlaviyoApiCredentials) {
    const query = new URLSearchParams({
      "page[size]": "25",
      filter: "equals(messages.channel,'email')",
      sort: "-updated_at",
      "fields[campaign]": "status,archived,created_at,scheduled_at,updated_at",
    });
    const body = this.object(
      await this.send(credentials, `/api/campaigns?${query.toString()}`),
    );
    return {
      accountId: credentials.accountId,
      campaigns: this.rows(body.data)
        .slice(0, 25)
        .map((row) => this.campaign(row)),
    };
  }

  private async send(credentials: KlaviyoApiCredentials, path: string) {
    if (!ID.test(credentials.accountId))
      throw new KlaviyoApiError(
        "klaviyo_account_binding_invalid",
        "Klaviyo connection is not bound to a valid Account ID.",
      );
    if (!credentials.accessToken.trim())
      throw new KlaviyoApiError(
        "klaviyo_token_invalid",
        "Klaviyo connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/api/"))
      throw new KlaviyoApiError(
        "klaviyo_request_invalid",
        "Klaviyo request escaped the fixed API boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${credentials.accessToken}`,
          revision: KLAVIYO_API_REVISION,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new KlaviyoApiError(
        "klaviyo_unavailable",
        "Klaviyo is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new KlaviyoApiError(
        "klaviyo_response_too_large",
        "Klaviyo response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new KlaviyoApiError(
        "klaviyo_response_invalid",
        "Klaviyo returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new KlaviyoApiError(
        response.status === 401
          ? "klaviyo_token_invalid"
          : response.status === 403
            ? "klaviyo_permission_denied"
            : response.status === 429
              ? "klaviyo_rate_limited"
              : "klaviyo_http_error",
        "Klaviyo API request failed.",
        response.status,
        {
          retryAfter: response.headers.get("retry-after"),
          rateLimitRemaining: response.headers.get("ratelimit-remaining"),
          rateLimitReset: response.headers.get("ratelimit-reset"),
        },
      );
    return body;
  }

  private first(value: unknown) {
    const data = this.rows(this.object(value).data);
    if (data.length !== 1)
      throw new KlaviyoApiError(
        "klaviyo_account_binding_invalid",
        "Klaviyo Account response did not contain exactly one Account.",
      );
    return data[0];
  }

  private resource(row: Record<string, unknown>) {
    const id = typeof row.id === "string" && ID.test(row.id) ? row.id : null;
    return { id, attributes: this.object(row.attributes) };
  }

  private account(row: Record<string, unknown>) {
    const { id, attributes } = this.resource(row);
    return {
      accountId: id,
      name: this.scalar(attributes.name),
      timezone: this.scalar(attributes.timezone),
      currency: this.scalar(attributes.currency),
    };
  }

  private list(row: Record<string, unknown>) {
    const { id, attributes } = this.resource(row);
    return {
      listId: id,
      name: this.scalar(attributes.name),
      createdAt: this.scalar(attributes.created),
      updatedAt: this.scalar(attributes.updated),
      optInProcess: this.scalar(attributes.opt_in_process),
    };
  }

  private campaign(row: Record<string, unknown>) {
    const { id, attributes } = this.resource(row);
    return {
      campaignId: id,
      status: this.scalar(attributes.status),
      archived: this.scalar(attributes.archived),
      createdAt: this.scalar(attributes.created_at),
      scheduledAt: this.scalar(attributes.scheduled_at),
      updatedAt: this.scalar(attributes.updated_at),
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
}
