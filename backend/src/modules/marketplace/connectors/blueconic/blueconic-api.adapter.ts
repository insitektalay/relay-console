import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type BlueConicCredentials = {
  tenantName: string;
  clientId: string;
  clientSecret: string;
};

export class BlueConicApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class BlueConicApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: BlueConicCredentials) {
    const summary = await this.getSegmentReadinessSummary(credentials);
    return {
      apiOrigin: this.origin(credentials),
      segmentCount: summary.segmentCount,
    };
  }

  async getSegmentReadinessSummary(credentials: BlueConicCredentials) {
    const origin = this.origin(credentials);
    const token = await this.accessToken(credentials, origin);
    const root = await this.request(
      new URL("/rest/v2/segments", origin),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-BlueConic/1.0",
        },
      },
    );
    const object = this.object(root);
    const segments = Array.isArray(root)
      ? root
      : Array.isArray(object.data)
        ? object.data
        : Array.isArray(object.items)
          ? object.items
          : Array.isArray(object.segments)
            ? object.segments
            : null;
    if (!segments)
      throw new BlueConicApiError(
        "provider_validation_error",
        "BlueConic returned an unexpected segment-list shape.",
      );
    return {
      segmentCount: segments.length,
      redactionStatus:
        "tenant-segment-identity-definitions-membership-profile-and-customer-data-excluded",
    };
  }

  private async accessToken(credentials: BlueConicCredentials, origin: string) {
    this.validate(credentials);
    const root = this.object(
      await this.request(new URL("/rest/v2/oauth/token", origin), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }).toString(),
      }),
    );
    const token = typeof root.access_token === "string" ? root.access_token : "";
    if (!token || token.length > 30_000 || /[\r\n]/.test(token))
      throw new BlueConicApiError(
        "token_refresh_failed",
        "BlueConic did not return a usable access token.",
      );
    return token;
  }

  private async request(url: URL, init: RequestInit) {
    let response: Response;
    try {
      response = await this.requester(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof BlueConicApiError) throw error;
      throw new BlueConicApiError(
        "provider_unavailable",
        "BlueConic could not be reached.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 1_000_000)
      throw new BlueConicApiError(
        "provider_validation_error",
        "BlueConic response exceeds 1 MB.",
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new BlueConicApiError(
        "provider_validation_error",
        "BlueConic returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new BlueConicApiError(
        this.code(response.status),
        `BlueConic returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private origin(credentials: BlueConicCredentials) {
    this.validate(credentials);
    return `https://www.${credentials.tenantName.toLowerCase()}.blueconic.net`;
  }

  private validate(credentials: BlueConicCredentials) {
    const tenant = credentials.tenantName.trim().toLowerCase();
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant) ||
      !credentials.clientId.trim() ||
      credentials.clientId.length > 500 ||
      /[\r\n]/.test(credentials.clientId) ||
      !credentials.clientSecret.trim() ||
      credentials.clientSecret.length > 30_000 ||
      /[\r\n]/.test(credentials.clientSecret)
    )
      throw new BlueConicApiError(
        "credential_missing",
        "Valid BlueConic tenant and client credentials are required.",
        401,
      );
  }

  private object(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Obj)
      : {};
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
