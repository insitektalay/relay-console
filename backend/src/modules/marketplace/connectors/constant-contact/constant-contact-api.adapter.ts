import { Injectable } from "@nestjs/common";

export type ConstantContactApiCredentials = {
  accessToken: string;
  accountId: string;
};
export class ConstantContactApiError extends Error {
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
const API_ORIGIN = "https://api.cc.email";
const ACCOUNT_ID = /^[A-Za-z0-9_-]{6,128}$/;

@Injectable()
export class ConstantContactApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ConstantContactApiCredentials) {
    const account = this.account(
      await this.send(credentials, "/v3/account/summary"),
    );
    this.assertBound(credentials, account.accountId);
    return {
      accountId: credentials.accountId,
      apiOrigin: API_ORIGIN,
      apiVersion: "v3",
      reachable: true,
    };
  }
  async getAccount(credentials: ConstantContactApiCredentials) {
    const account = this.account(
      await this.send(credentials, "/v3/account/summary"),
    );
    this.assertBound(credentials, account.accountId);
    return { account };
  }
  async listRecentCampaigns(credentials: ConstantContactApiCredentials) {
    const body = this.object(
      await this.send(credentials, "/v3/emails?limit=25"),
    );
    return {
      accountId: credentials.accountId,
      campaigns: this.rows(body.campaigns)
        .slice(0, 25)
        .map((row) => ({
          campaignId: this.scalar(row.campaign_id),
          type: this.scalar(row.type),
          currentStatus: this.scalar(row.current_status),
          createdAt: this.scalar(row.created_at),
          updatedAt: this.scalar(row.updated_at),
        })),
    };
  }
  async listRecentCampaignSummaries(
    credentials: ConstantContactApiCredentials,
  ) {
    const body = this.object(
      await this.send(
        credentials,
        "/v3/reports/summary_reports/email_campaign_summaries?limit=25",
      ),
    );
    return {
      accountId: credentials.accountId,
      summaries: this.rows(body.bulk_email_campaign_summaries)
        .slice(0, 25)
        .map((row) => {
          const counts = this.object(row.unique_counts);
          return {
            campaignId: this.scalar(row.campaign_id),
            campaignType: this.scalar(row.campaign_type),
            lastSentDate: this.scalar(row.last_sent_date),
            uniqueCounts: {
              sends: this.scalar(counts.sends),
              opens: this.scalar(counts.opens),
              clicks: this.scalar(counts.clicks),
              forwards: this.scalar(counts.forwards),
              optouts: this.scalar(counts.optouts),
              abuse: this.scalar(counts.abuse),
              bounces: this.scalar(counts.bounces),
              notOpened: this.scalar(counts.not_opened),
            },
          };
        }),
      aggregatePercents: this.aggregatePercents(body.aggregate_percents),
    };
  }
  private async send(credentials: ConstantContactApiCredentials, path: string) {
    if (!ACCOUNT_ID.test(credentials.accountId))
      throw new ConstantContactApiError(
        "constant_contact_account_binding_invalid",
        "Constant Contact connection is not bound to a valid encoded Account ID.",
      );
    if (!credentials.accessToken.trim())
      throw new ConstantContactApiError(
        "constant_contact_token_invalid",
        "Constant Contact connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/v3/"))
      throw new ConstantContactApiError(
        "constant_contact_request_invalid",
        "Constant Contact request escaped the fixed API boundary.",
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
      throw new ConstantContactApiError(
        "constant_contact_unavailable",
        "Constant Contact is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new ConstantContactApiError(
        "constant_contact_response_too_large",
        "Constant Contact response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ConstantContactApiError(
        "constant_contact_response_invalid",
        "Constant Contact returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new ConstantContactApiError(
        response.status === 401
          ? "constant_contact_token_invalid"
          : response.status === 403
            ? "constant_contact_permission_denied"
            : response.status === 429
              ? "constant_contact_rate_limited"
              : "constant_contact_http_error",
        "Constant Contact API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }
  private account(value: unknown) {
    const row = this.object(value);
    return {
      accountId: this.scalar(row.encoded_account_id),
      organizationName: this.scalar(row.organization_name),
    };
  }
  private assertBound(
    credentials: ConstantContactApiCredentials,
    value: unknown,
  ) {
    if (value !== credentials.accountId)
      throw new ConstantContactApiError(
        "constant_contact_account_binding_mismatch",
        "Constant Contact Account binding changed.",
      );
  }
  private aggregatePercents(value: unknown) {
    const row = this.object(value);
    return {
      click: this.scalar(row.click),
      open: this.scalar(row.open),
      didNotOpen: this.scalar(row.did_not_open),
      bounce: this.scalar(row.bounce),
      unsubscribe: this.scalar(row.unsubscribe),
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
