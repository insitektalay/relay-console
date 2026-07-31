import { Injectable } from "@nestjs/common";

export type MailchimpApiCredentials = {
  accessToken: string;
  apiOrigin: string;
  accountId: string;
};

export class MailchimpApiError extends Error {
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
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;
const API_ORIGIN = /^https:\/\/[a-z0-9-]{1,20}\.api\.mailchimp\.com$/;

@Injectable()
export class MailchimpApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: MailchimpApiCredentials) {
    const account = this.account(
      this.object(
        await this.send(
          credentials,
          "/3.0/?fields=account_id%2Caccount_name%2Crole%2Cmember_since",
        ),
      ),
    );
    if (account.accountId !== credentials.accountId)
      throw new MailchimpApiError(
        "mailchimp_account_binding_mismatch",
        "Mailchimp account binding changed.",
      );
    return {
      accountId: credentials.accountId,
      apiOrigin: credentials.apiOrigin,
      role: account.role,
      apiVersion: "3.0",
      reachable: true,
    };
  }

  async getAccount(credentials: MailchimpApiCredentials) {
    const account = this.account(
      this.object(
        await this.send(
          credentials,
          "/3.0/?fields=account_id%2Caccount_name%2Crole%2Cmember_since",
        ),
      ),
    );
    if (account.accountId !== credentials.accountId)
      throw new MailchimpApiError(
        "mailchimp_account_binding_mismatch",
        "Mailchimp account binding changed.",
      );
    return { account };
  }

  async listAudiences(credentials: MailchimpApiCredentials) {
    const query = new URLSearchParams({
      count: "25",
      offset: "0",
      sort_field: "date_created",
      sort_dir: "DESC",
      fields:
        "lists.id,lists.name,lists.date_created,lists.stats.member_count,lists.stats.unsubscribe_count",
    });
    const body = this.object(
      await this.send(credentials, `/3.0/lists?${query.toString()}`),
    );
    return {
      accountId: credentials.accountId,
      audiences: this.rows(body.lists)
        .slice(0, 25)
        .map((row) => this.audience(row)),
    };
  }

  async listRecentSentCampaigns(credentials: MailchimpApiCredentials) {
    const query = new URLSearchParams({
      count: "25",
      offset: "0",
      status: "sent",
      sort_field: "send_time",
      sort_dir: "DESC",
      fields:
        "campaigns.id,campaigns.type,campaigns.status,campaigns.create_time,campaigns.send_time",
    });
    const body = this.object(
      await this.send(credentials, `/3.0/campaigns?${query.toString()}`),
    );
    return {
      accountId: credentials.accountId,
      campaigns: this.rows(body.campaigns)
        .slice(0, 25)
        .map((row) => this.campaign(row)),
    };
  }

  private async send(credentials: MailchimpApiCredentials, path: string) {
    const apiOrigin = credentials.apiOrigin.replace(/\/$/, "").toLowerCase();
    if (!API_ORIGIN.test(apiOrigin))
      throw new MailchimpApiError(
        "mailchimp_api_origin_invalid",
        "Mailchimp connection is not bound to an official metadata-derived API origin.",
      );
    if (!ACCOUNT_ID.test(credentials.accountId))
      throw new MailchimpApiError(
        "mailchimp_account_binding_invalid",
        "Mailchimp connection is not bound to a valid account ID.",
      );
    if (!credentials.accessToken.trim())
      throw new MailchimpApiError(
        "mailchimp_token_invalid",
        "Mailchimp connection token is missing.",
      );
    const url = new URL(path, apiOrigin);
    if (url.origin !== apiOrigin || !url.pathname.startsWith("/3.0/"))
      throw new MailchimpApiError(
        "mailchimp_request_invalid",
        "Mailchimp request escaped the fixed Marketing API boundary.",
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
      throw new MailchimpApiError(
        "mailchimp_unavailable",
        "Mailchimp is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new MailchimpApiError(
        "mailchimp_response_too_large",
        "Mailchimp response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MailchimpApiError(
        "mailchimp_response_invalid",
        "Mailchimp returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new MailchimpApiError(
        response.status === 401
          ? "mailchimp_token_invalid"
          : response.status === 403
            ? "mailchimp_permission_denied"
            : response.status === 429
              ? "mailchimp_rate_limited"
              : "mailchimp_http_error",
        "Mailchimp Marketing API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private account(row: Record<string, unknown>) {
    return {
      accountId: this.id(row.account_id),
      accountName: this.scalar(row.account_name),
      role: this.scalar(row.role),
      memberSince: this.scalar(row.member_since),
    };
  }

  private audience(row: Record<string, unknown>) {
    const stats = this.object(row.stats);
    return {
      audienceId: this.scalar(row.id),
      name: this.scalar(row.name),
      createdAt: this.scalar(row.date_created),
      memberCount: this.scalar(stats.member_count),
      unsubscribeCount: this.scalar(stats.unsubscribe_count),
    };
  }

  private campaign(row: Record<string, unknown>) {
    return {
      campaignId: this.scalar(row.id),
      type: this.scalar(row.type),
      status: this.scalar(row.status),
      createdAt: this.scalar(row.create_time),
      sentAt: this.scalar(row.send_time),
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
    const id = typeof value === "string" ? value : "";
    return ACCOUNT_ID.test(id) ? id : null;
  }
}
