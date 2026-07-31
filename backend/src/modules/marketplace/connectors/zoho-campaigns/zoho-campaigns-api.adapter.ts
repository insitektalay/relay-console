import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type ZohoCampaignsCredentials = {
  accessToken: string;
  apiOrigin: string;
  accountsOrigin: string;
  userId: string;
};

const API_ORIGINS = new Set([
  "https://campaigns.zoho.com",
  "https://campaigns.zoho.eu",
  "https://campaigns.zoho.in",
  "https://campaigns.zoho.com.au",
  "https://campaigns.zoho.jp",
  "https://campaigns.zoho.com.cn",
]);
const ACCOUNTS_ORIGINS = new Set([
  "https://accounts.zoho.com",
  "https://accounts.zoho.eu",
  "https://accounts.zoho.in",
  "https://accounts.zoho.com.au",
  "https://accounts.zoho.jp",
  "https://accounts.zoho.com.cn",
]);
const STATUSES = new Set([
  "all",
  "drafts",
  "scheduled",
  "inprogress",
  "sent",
  "stopped",
  "canceled",
  "tobereviewed",
  "reviewed",
  "paused",
  "intesting",
]);

export class ZohoCampaignsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ZohoCampaignsApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ZohoCampaignsCredentials) {
    const [profileBody] = await Promise.all([
      this.request(
        credentials,
        credentials.accountsOrigin,
        "/oauth/user/info",
        new URLSearchParams(),
      ),
      this.request(
        credentials,
        credentials.apiOrigin,
        "/api/v1.1/recentcampaigns",
        new URLSearchParams({
          resfmt: "JSON",
          sort: "desc",
          fromindex: "1",
          range: "1",
          status: "all",
        }),
      ),
    ]);
    const profile = this.record(profileBody);
    const userId = this.id(
      profile.ZUID ??
        profile.zuid ??
        profile.User_Id ??
        profile.user_id ??
        profile.id,
      "user",
      25,
    );
    if (userId !== credentials.userId)
      throw new ZohoCampaignsApiError(
        "insufficient_scope",
        "Zoho Campaigns connected-user binding changed.",
        403,
      );
    return {
      userId,
      displayName:
        this.text(
          profile.Display_Name ?? profile.display_name ?? profile.name,
          200,
        ) || null,
      email:
        this.email(profile.Email ?? profile.email ?? profile.Email_Id) || null,
      apiOrigin: credentials.apiOrigin,
      accountsOrigin: credentials.accountsOrigin,
    };
  }

  async listCampaigns(
    credentials: ZohoCampaignsCredentials,
    input: { status?: string; limit?: number },
  ) {
    const status = input.status ?? "all";
    if (!STATUSES.has(status))
      throw new ZohoCampaignsApiError(
        "provider_validation_error",
        "Zoho Campaigns status is invalid.",
      );
    const limit =
      Number.isInteger(input.limit) && input.limit! >= 1 && input.limit! <= 25
        ? input.limit!
        : 25;
    const body = this.record(
      await this.request(
        credentials,
        credentials.apiOrigin,
        "/api/v1.1/recentcampaigns",
        new URLSearchParams({
          resfmt: "JSON",
          sort: "desc",
          fromindex: "1",
          range: String(limit),
          status,
        }),
      ),
    );
    this.providerSuccess(body);
    const campaigns = Array.isArray(body.recent_campaigns)
      ? body.recent_campaigns
      : [];
    return {
      status,
      campaigns: campaigns.slice(0, limit).map((value) => {
        const item = this.record(value);
        return {
          campaignKey: this.id(item.campaign_key, "campaign", 100),
          name: this.text(item.campaign_name, 300),
          status: this.text(item.campaign_status, 100),
          createdAt:
            this.text(item.created_time ?? item.created_date_string, 100) ||
            null,
        };
      }),
    };
  }

  async campaignReport(
    credentials: ZohoCampaignsCredentials,
    input: { campaignKey: string },
  ) {
    const campaignKey = this.id(input.campaignKey, "campaign", 100);
    const body = this.record(
      await this.request(
        credentials,
        credentials.apiOrigin,
        "/api/v1.1/campaignreports",
        new URLSearchParams({ resfmt: "JSON", campaignkey: campaignKey }),
      ),
    );
    this.providerSuccess(body);
    const reports = Array.isArray(body["campaign-reports"])
      ? body["campaign-reports"]
      : [];
    const report = this.record(reports[0]);
    return {
      campaignKey,
      metrics: {
        emailsSent: this.number(report.emails_sent_count),
        delivered: this.number(report.delivered_count),
        opens: this.number(report.opens_count),
        uniqueClicks: this.number(report.unique_clicks_count),
        bounces: this.number(report.bounces_count),
        unsubscribes: this.number(report.unsub_count),
        complaints: this.number(report.complaints_count),
        deliveredPercent: this.number(report.delivered_percent),
        openPercent: this.number(report.open_percent),
        uniqueClickedPercent: this.number(report.unique_clicked_percent),
      },
    };
  }

  private async request(
    credentials: ZohoCampaignsCredentials,
    origin: string,
    path: string,
    query: URLSearchParams,
  ) {
    this.credentials(credentials);
    if (
      (origin !== credentials.apiOrigin &&
        origin !== credentials.accountsOrigin) ||
      !/^\/[A-Za-z0-9_.\/-]+$/.test(path) ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new ZohoCampaignsApiError(
        "provider_validation_error",
        "Zoho Campaigns request authority or path is invalid.",
      );
    const url = new URL(path, `${origin}/`);
    url.search = query.toString();
    const response = await this.requester(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Zoho-oauthtoken ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-ZohoCampaigns/1.0",
      },
    });
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw new ZohoCampaignsApiError(
        "provider_validation_error",
        "Zoho Campaigns response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new ZohoCampaignsApiError(
        "provider_validation_error",
        "Zoho Campaigns response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ZohoCampaignsApiError(
        "provider_validation_error",
        "Zoho Campaigns returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ZohoCampaignsApiError(
        this.safeCode(response.status),
        `Zoho Campaigns returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private providerSuccess(body: JsonObject) {
    if (
      String(body.code ?? "0") !== "0" ||
      (body.status && body.status !== "success")
    )
      throw new ZohoCampaignsApiError(
        "provider_validation_error",
        `Zoho Campaigns rejected the request with code ${this.text(body.code, 40) || "unknown"}.`,
      );
  }

  private credentials(credentials: ZohoCampaignsCredentials) {
    if (!credentials.accessToken.trim())
      throw new ZohoCampaignsApiError(
        "credential_missing",
        "Zoho Campaigns access token is required.",
        401,
      );
    this.id(credentials.userId, "user", 25);
    if (
      !API_ORIGINS.has(credentials.apiOrigin) ||
      !ACCOUNTS_ORIGINS.has(credentials.accountsOrigin)
    )
      throw new ZohoCampaignsApiError(
        "provider_validation_error",
        "Zoho Campaigns regional authority is not allowlisted.",
      );
  }

  private id(value: unknown, label: string, maximum: number) {
    const text = this.text(value, maximum);
    if (!/^[A-Za-z0-9]+$/.test(text))
      throw new ZohoCampaignsApiError(
        "provider_validation_error",
        `Zoho Campaigns ${label} identifier is invalid.`,
      );
    return text;
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim().slice(0, maximum)
        : "";
  }
  private email(value: unknown) {
    const text = this.text(value, 320).toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
  }
  private number(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
