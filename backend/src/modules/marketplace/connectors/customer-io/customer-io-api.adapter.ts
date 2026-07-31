import { Injectable } from "@nestjs/common";

export type CustomerIoCredentials = {
  apiOrigin: string;
  appApiKey: string;
  workspaceId: string;
};

export class CustomerIoApiError extends Error {
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
const API_ORIGINS = new Set([
  "https://api.customer.io",
  "https://api-eu.customer.io",
]);
const WORKSPACE_API_ORIGIN = "https://api.customer.io";
const ID = /^[1-9][0-9]{0,31}$/;

@Injectable()
export class CustomerIoApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: CustomerIoCredentials) {
    const binding = await this.workspaceBinding(credentials);
    return { ...binding, apiVersion: "v1", reachable: true };
  }

  async workspaceBinding(credentials: CustomerIoCredentials) {
    const workspaceId = this.requiredId(
      credentials.workspaceId,
      "customer_io_workspace_identifier_invalid",
      "A valid exact Customer.io Workspace ID is required.",
    );
    const body = this.object(
      await this.send(credentials, "/v1/workspaces", WORKSPACE_API_ORIGIN),
    );
    const match = this.rows(body.workspaces).find(
      (workspace) => this.id(workspace.id) === workspaceId,
    );
    if (!match)
      throw new CustomerIoApiError(
        "customer_io_workspace_mismatch",
        "Customer.io App API key cannot validate the configured Workspace ID.",
      );
    return { apiOrigin: this.origin(credentials.apiOrigin), workspaceId };
  }

  async listCampaigns(credentials: CustomerIoCredentials) {
    const body = this.object(await this.send(credentials, "/v1/campaigns"));
    return {
      campaigns: this.rows(body.campaigns)
        .slice(0, 25)
        .map((row) => ({
          campaignId: this.id(row.id),
          type: this.scalar(row.type),
          state: this.scalar(row.state),
          active: this.scalar(row.active),
          createdAt: this.scalar(row.created),
          updatedAt: this.scalar(row.updated),
          firstStartedAt: this.scalar(row.first_started),
        })),
    };
  }

  async listBroadcasts(credentials: CustomerIoCredentials) {
    const body = this.object(await this.send(credentials, "/v1/broadcasts"));
    return {
      broadcasts: this.rows(body.broadcasts)
        .slice(0, 25)
        .map((row) => ({
          broadcastId: this.id(row.id),
          type: this.scalar(row.type),
          state: this.scalar(row.state),
          active: this.scalar(row.active),
          createdAt: this.scalar(row.created),
          updatedAt: this.scalar(row.updated),
          firstStartedAt: this.scalar(row.first_started),
        })),
    };
  }

  private async send(
    credentials: CustomerIoCredentials,
    path: string,
    fixedOrigin?: string,
  ) {
    const configuredOrigin = this.origin(credentials.apiOrigin);
    const origin = fixedOrigin ?? configuredOrigin;
    const appApiKey = credentials.appApiKey.trim();
    if (appApiKey.length < 8 || appApiKey.length > 4096)
      throw new CustomerIoApiError(
        "customer_io_app_api_key_invalid",
        "Customer.io App API key is missing or invalid.",
      );
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/v1/"))
      throw new CustomerIoApiError(
        "customer_io_request_invalid",
        "Customer.io request escaped the fixed App API v1 boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${appApiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new CustomerIoApiError(
        "customer_io_unavailable",
        "Customer.io is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new CustomerIoApiError(
        "customer_io_response_too_large",
        "Customer.io response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new CustomerIoApiError(
        "customer_io_response_invalid",
        "Customer.io returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new CustomerIoApiError(
        response.status === 401
          ? "customer_io_app_api_key_invalid"
          : response.status === 403
            ? "customer_io_permission_denied"
            : response.status === 429
              ? "customer_io_rate_limited"
              : "customer_io_http_error",
        "Customer.io App API request failed.",
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
      throw new CustomerIoApiError(
        "customer_io_api_origin_invalid",
        "Customer.io App API origin is invalid.",
      );
    }
    if (
      !API_ORIGINS.has(url.origin) ||
      url.protocol !== "https:" ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new CustomerIoApiError(
        "customer_io_api_origin_invalid",
        "Customer.io connection is not bound to an official US or EU App API origin.",
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

  private requiredId(value: unknown, code: string, message: string) {
    const id = this.id(value);
    if (!id) throw new CustomerIoApiError(code, message);
    return id;
  }
}
