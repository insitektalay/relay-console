import { Injectable } from "@nestjs/common";

export type CampaignMonitorApiCredentials = {
  accessToken: string;
  clientId: string;
};

export class CampaignMonitorApiError extends Error {
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
const API_ORIGIN = "https://api.createsend.com";
const API_ROOT = `${API_ORIGIN}/api/v3.3`;
const ID = /^[A-Fa-f0-9]{32}$/;

@Injectable()
export class CampaignMonitorApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: CampaignMonitorApiCredentials) {
    const client = await this.boundClient(credentials);
    return {
      clientId: client.clientId,
      apiOrigin: API_ORIGIN,
      apiVersion: "v3.3",
      reachable: true,
    };
  }

  async getClient(credentials: CampaignMonitorApiCredentials) {
    return { client: await this.boundClient(credentials) };
  }

  async listRecentSentCampaigns(credentials: CampaignMonitorApiCredentials) {
    return {
      clientId: credentials.clientId,
      campaigns: await this.recentCampaigns(credentials),
    };
  }

  async getCampaignSummary(
    credentials: CampaignMonitorApiCredentials,
    input: Record<string, unknown>,
  ) {
    const campaignId = this.id(input.campaignId, "campaign");
    const campaigns = await this.recentCampaigns(credentials);
    if (!campaigns.some((campaign) => campaign.campaignId === campaignId))
      throw new CampaignMonitorApiError(
        "campaign_monitor_campaign_not_bound",
        "Campaign is not in the bound Client's current bounded sent-Campaign list.",
      );
    const body = this.object(
      await this.send(credentials, `/campaigns/${campaignId}/summary.json`),
    );
    return {
      clientId: credentials.clientId,
      campaignId,
      summary: {
        recipients: this.scalar(body.Recipients),
        totalOpened: this.scalar(body.TotalOpened),
        uniqueOpened: this.scalar(body.UniqueOpened),
        clicks: this.scalar(body.Clicks),
        unsubscribed: this.scalar(body.Unsubscribed),
        bounced: this.scalar(body.Bounced),
        spamComplaints: this.scalar(body.SpamComplaints),
        forwards: this.scalar(body.Forwards),
        likes: this.scalar(body.Likes),
        mentions: this.scalar(body.Mentions),
      },
    };
  }

  private async boundClient(credentials: CampaignMonitorApiCredentials) {
    const clients = this.rows(await this.send(credentials, "/clients.json"));
    const client = clients.find(
      (row) =>
        this.string(row.ClientID)?.toLowerCase() === credentials.clientId,
    );
    if (!client)
      throw new CampaignMonitorApiError(
        "campaign_monitor_client_binding_mismatch",
        "Selected Campaign Monitor Client is no longer visible.",
      );
    return {
      clientId: credentials.clientId,
      name: this.scalar(client.Name),
    };
  }

  private async recentCampaigns(credentials: CampaignMonitorApiCredentials) {
    const body = await this.send(
      credentials,
      `/clients/${credentials.clientId}/campaigns.json?page=1&pagesize=20&orderdirection=desc`,
    );
    const object = this.object(body);
    const rows = Array.isArray(body)
      ? this.rows(body)
      : this.rows(object.Results);
    return rows.slice(0, 20).map((row) => ({
      campaignId: this.string(row.CampaignID)?.toLowerCase() ?? null,
      sentDate: this.scalar(row.SentDate),
    }));
  }

  private async send(credentials: CampaignMonitorApiCredentials, path: string) {
    const clientId = this.id(credentials.clientId, "client");
    if (clientId !== credentials.clientId)
      throw new CampaignMonitorApiError(
        "campaign_monitor_client_binding_invalid",
        "Campaign Monitor connection has a non-canonical Client binding.",
      );
    if (!credentials.accessToken.trim())
      throw new CampaignMonitorApiError(
        "campaign_monitor_token_invalid",
        "Campaign Monitor connection token is missing.",
      );
    const url = new URL(`${API_ROOT}${path}`);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/api/v3.3/"))
      throw new CampaignMonitorApiError(
        "campaign_monitor_request_invalid",
        "Campaign Monitor request escaped the fixed API boundary.",
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
      throw new CampaignMonitorApiError(
        "campaign_monitor_unavailable",
        "Campaign Monitor is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new CampaignMonitorApiError(
        "campaign_monitor_response_too_large",
        "Campaign Monitor response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new CampaignMonitorApiError(
        "campaign_monitor_response_invalid",
        "Campaign Monitor returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new CampaignMonitorApiError(
        response.status === 401
          ? "campaign_monitor_token_invalid"
          : response.status === 403
            ? "campaign_monitor_permission_denied"
            : response.status === 429
              ? "campaign_monitor_rate_limited"
              : "campaign_monitor_http_error",
        "Campaign Monitor API request failed.",
        response.status,
        {
          rateLimitLimit: response.headers.get("x-ratelimit-limit"),
          rateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
          rateLimitReset: response.headers.get("x-ratelimit-reset"),
        },
      );
    return body;
  }

  private id(value: unknown, kind: "client" | "campaign") {
    const id = this.string(value)?.toLowerCase();
    if (!id || !ID.test(id))
      throw new CampaignMonitorApiError(
        `campaign_monitor_${kind}_id_invalid`,
        `A canonical 32-hex Campaign Monitor ${kind} ID is required.`,
      );
    return id;
  }

  private rows(value: unknown) {
    return Array.isArray(value) ? value.map((item) => this.object(item)) : [];
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
}
