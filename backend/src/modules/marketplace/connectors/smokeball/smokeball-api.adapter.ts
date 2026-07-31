import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type SmokeballCredentials = { accessToken: string; apiKey: string };

export class SmokeballApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SmokeballApiAdapter {
  static readonly origin = "https://api.smokeball.com";
  static readonly apiVersion = "v1";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: SmokeballCredentials) {
    await this.getConnectionAuthority(credentials);
    return {
      apiOrigin: SmokeballApiAdapter.origin,
      apiRegion: "us",
      apiVersion: SmokeballApiAdapter.apiVersion,
    };
  }

  async getConnectionAuthority(credentials: SmokeballCredentials) {
    const accessToken = credentials.accessToken.trim();
    const apiKey = credentials.apiKey.trim();
    if (
      !accessToken ||
      accessToken.length > 30_000 ||
      /[\r\n]/.test(accessToken) ||
      !apiKey ||
      apiKey.length > 2_000 ||
      /[\r\n]/.test(apiKey)
    )
      throw new SmokeballApiError(
        "credential_missing",
        "Smokeball OAuth access token or API key is missing or invalid.",
      );
    const response = await this.requester(
      new URL("/firm", SmokeballApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": apiKey,
          "User-Agent": "RelayConsole-Smokeball/1.0",
        },
      },
    ).catch(() => {
      throw new SmokeballApiError(
        "provider_unavailable",
        "Smokeball could not be reached.",
      );
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 65_536)
      throw new SmokeballApiError(
        "provider_validation_error",
        "Smokeball response exceeded 64 KB.",
      );
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 65_536)
      throw new SmokeballApiError(
        "provider_validation_error",
        "Smokeball response exceeded 64 KB.",
      );
    if (!response.ok)
      throw new SmokeballApiError(
        this.code(response.status),
        `Smokeball returned HTTP ${response.status}.`,
        response.status,
      );
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new SmokeballApiError(
        "provider_validation_error",
        "Smokeball returned invalid JSON.",
      );
    }
    if (
      typeof body.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.id,
      )
    )
      throw new SmokeballApiError(
        "provider_validation_error",
        "Smokeball returned an invalid firm authority response.",
      );
    return {
      authorized: true,
      apiRegion: "us",
      apiVersion: SmokeballApiAdapter.apiVersion,
      redactionStatus:
        "firm-identity-client-matter-document-communication-and-financial-data-excluded",
    };
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
