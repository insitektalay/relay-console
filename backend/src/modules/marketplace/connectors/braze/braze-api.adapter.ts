import { Injectable } from "@nestjs/common";

export type BrazeCredentials = { restEndpoint: string; restApiKey: string };

export class BrazeApiError extends Error {
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
const REST_HOST =
  /^(?:rest\.(?:iad-0[1-8]|us-10|au-01|id-01|jp-01|kr-01)\.braze\.com|rest\.fra-0[12]\.braze\.eu)$/;
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;

@Injectable()
export class BrazeApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: BrazeCredentials) {
    await Promise.all([
      this.campaignPage(credentials),
      this.canvasPage(credentials),
    ]);
    return {
      restEndpoint: this.origin(credentials.restEndpoint),
      permissions: ["campaigns.list", "campaigns.data_series", "canvas.list"],
      reachable: true,
    };
  }

  async listCampaigns(credentials: BrazeCredentials) {
    const body = await this.campaignPage(credentials);
    return {
      campaigns: this.rows(body.campaigns)
        .slice(0, 25)
        .map((row) => ({
          campaignId: this.id(row.id),
          lastEditedAt: this.scalar(row.last_edited),
          isApiCampaign: this.scalar(row.is_api_campaign),
        })),
    };
  }

  async listCanvases(credentials: BrazeCredentials) {
    const body = await this.canvasPage(credentials);
    return {
      canvases: this.rows(body.canvases)
        .slice(0, 25)
        .map((row) => ({
          canvasId: this.id(row.id),
          lastEditedAt: this.scalar(row.last_edited),
        })),
    };
  }

  async getCampaignAnalytics(
    credentials: BrazeCredentials,
    input: Record<string, unknown>,
  ) {
    const campaignId = this.requiredId(input.campaignId);
    const endingAt = this.requiredTimestamp(input.endingAt);
    const campaigns = this.rows(
      (await this.campaignPage(credentials)).campaigns,
    );
    if (!campaigns.some((row) => this.id(row.id) === campaignId))
      throw new BrazeApiError(
        "braze_campaign_not_bound",
        "Braze Campaign ID is not present in the fixed newest unarchived Campaign page.",
      );
    const query = new URLSearchParams({
      campaign_id: campaignId,
      length: "7",
      ending_at: endingAt,
    });
    const body = this.object(
      await this.send(
        credentials,
        `/campaigns/data_series?${query.toString()}`,
      ),
    );
    return {
      campaignId,
      endingAt,
      lengthDays: 7,
      daily: this.rows(body.data)
        .slice(0, 7)
        .map((row) => ({
          date: this.scalar(row.time),
          uniqueRecipients: this.scalar(row.unique_recipients),
          conversions: this.scalar(row.conversions),
          conversionsBySendTime: this.scalar(row.conversions_by_send_time),
          revenueUsd: this.scalar(row.revenue),
        })),
    };
  }

  private async campaignPage(credentials: BrazeCredentials) {
    return this.object(
      await this.send(
        credentials,
        "/campaigns/list?page=0&include_archived=false&sort_direction=desc",
      ),
    );
  }

  private async canvasPage(credentials: BrazeCredentials) {
    return this.object(
      await this.send(
        credentials,
        "/canvas/list?page=0&include_archived=false&sort_direction=desc",
      ),
    );
  }

  private async send(credentials: BrazeCredentials, path: string) {
    const origin = this.origin(credentials.restEndpoint);
    const key = credentials.restApiKey.trim();
    if (key.length < 8 || key.length > 4096)
      throw new BrazeApiError(
        "braze_rest_api_key_invalid",
        "Braze REST API key is missing or invalid.",
      );
    const url = new URL(path, origin);
    if (
      url.origin !== origin ||
      !["/campaigns/list", "/campaigns/data_series", "/canvas/list"].includes(
        url.pathname,
      )
    )
      throw new BrazeApiError(
        "braze_request_invalid",
        "Braze request escaped the fixed export API boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${key}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BrazeApiError(
        "braze_unavailable",
        "Braze is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new BrazeApiError(
        "braze_response_too_large",
        "Braze response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new BrazeApiError(
        "braze_response_invalid",
        "Braze returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new BrazeApiError(
        response.status === 401
          ? "braze_rest_api_key_invalid"
          : response.status === 403
            ? "braze_permission_denied"
            : response.status === 429
              ? "braze_rate_limited"
              : "braze_http_error",
        "Braze REST API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private origin(raw: string) {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      throw new BrazeApiError(
        "braze_rest_endpoint_invalid",
        "Braze REST endpoint is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      !REST_HOST.test(url.hostname) ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new BrazeApiError(
        "braze_rest_endpoint_invalid",
        "Braze connection is not bound to a currently documented regional REST endpoint.",
      );
    return url.origin;
  }

  private requiredId(value: unknown) {
    if (typeof value !== "string" || !RESOURCE_ID.test(value))
      throw new BrazeApiError(
        "braze_campaign_identifier_invalid",
        "A valid bounded Braze Campaign API identifier is required.",
      );
    return value;
  }

  private requiredTimestamp(value: unknown) {
    if (
      typeof value !== "string" ||
      value.length > 64 ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
      !Number.isFinite(Date.parse(value))
    )
      throw new BrazeApiError(
        "braze_ending_timestamp_invalid",
        "A valid ISO-8601 endingAt timestamp is required.",
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

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private id(value: unknown) {
    return typeof value === "string" && RESOURCE_ID.test(value) ? value : null;
  }
}
