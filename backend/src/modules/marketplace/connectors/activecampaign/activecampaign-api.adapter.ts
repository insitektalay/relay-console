import { Injectable } from "@nestjs/common";

export type ActiveCampaignCredentials = {
  apiUrl: string;
  apiToken: string;
};

export class ActiveCampaignApiError extends Error {
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
const API_HOST = /^[a-z0-9-]{1,100}\.api-us1\.com$/;
const ID = /^[1-9][0-9]{0,31}$/;

@Injectable()
export class ActiveCampaignApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ActiveCampaignCredentials) {
    const result = await this.accountBinding(credentials);
    return { ...result, apiVersion: "3", reachable: true };
  }

  async accountBinding(credentials: ActiveCampaignCredentials) {
    const body = this.object(await this.send(credentials, "/api/3/users/me"));
    const user = this.object(body.user);
    const userId = this.id(user.id);
    if (!userId)
      throw new ActiveCampaignApiError(
        "activecampaign_user_binding_invalid",
        "ActiveCampaign token is not bound to one valid current user.",
      );
    return { apiOrigin: this.origin(credentials.apiUrl), userId };
  }

  async listRecentLists(credentials: ActiveCampaignCredentials) {
    const query = new URLSearchParams({
      limit: "25",
      offset: "0",
      "orders[id]": "DESC",
    });
    const body = this.object(
      await this.send(credentials, `/api/3/lists?${query.toString()}`),
    );
    return {
      lists: this.rows(body.lists)
        .slice(0, 25)
        .map((row) => ({
          listId: this.id(row.id),
          name: this.scalar(row.name),
          createdAt: this.scalar(row.cdate),
          isPrivate: this.scalar(row.private),
        })),
    };
  }

  async listRecentCampaigns(credentials: ActiveCampaignCredentials) {
    const query = new URLSearchParams({
      limit: "25",
      offset: "0",
      "orders[sdate]": "DESC",
    });
    const body = this.object(
      await this.send(credentials, `/api/3/campaigns?${query.toString()}`),
    );
    return {
      campaigns: this.rows(body.campaigns)
        .slice(0, 25)
        .map((row) => ({
          campaignId: this.id(row.id),
          type: this.scalar(row.type),
          status: this.scalar(row.status),
          createdAt: this.scalar(row.cdate),
          modifiedAt: this.scalar(row.mdate),
          scheduledAt: this.scalar(row.sdate),
          lastSentAt: this.scalar(row.ldate),
        })),
    };
  }

  private async send(credentials: ActiveCampaignCredentials, path: string) {
    const origin = this.origin(credentials.apiUrl);
    if (!credentials.apiToken.trim() || credentials.apiToken.length > 4096)
      throw new ActiveCampaignApiError(
        "activecampaign_api_token_invalid",
        "ActiveCampaign API token is missing or invalid.",
      );
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/api/3/"))
      throw new ActiveCampaignApiError(
        "activecampaign_request_invalid",
        "ActiveCampaign request escaped the fixed API v3 boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Api-Token": credentials.apiToken,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ActiveCampaignApiError(
        "activecampaign_unavailable",
        "ActiveCampaign is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new ActiveCampaignApiError(
        "activecampaign_response_too_large",
        "ActiveCampaign response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ActiveCampaignApiError(
        "activecampaign_response_invalid",
        "ActiveCampaign returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new ActiveCampaignApiError(
        response.status === 401 || response.status === 403
          ? "activecampaign_api_token_invalid"
          : response.status === 429
            ? "activecampaign_rate_limited"
            : "activecampaign_http_error",
        "ActiveCampaign API request failed.",
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
      throw new ActiveCampaignApiError(
        "activecampaign_api_origin_invalid",
        "ActiveCampaign API URL is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      !API_HOST.test(url.hostname) ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new ActiveCampaignApiError(
        "activecampaign_api_origin_invalid",
        "ActiveCampaign connection is not bound to an official account-specific API origin.",
      );
    return url.origin;
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
}
