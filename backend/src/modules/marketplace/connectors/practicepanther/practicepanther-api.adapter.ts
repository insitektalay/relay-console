import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type PracticePantherCredentials = { accessToken: string };

export class PracticePantherApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class PracticePantherApiAdapter {
  static readonly origin = "https://app.practicepanther.com";
  static readonly apiVersion = "v1";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: PracticePantherCredentials) {
    await this.getConnectionAuthority(credentials);
    return {
      apiOrigin: PracticePantherApiAdapter.origin,
      apiVersion: PracticePantherApiAdapter.apiVersion,
    };
  }

  async getConnectionAuthority(credentials: PracticePantherCredentials) {
    const token = credentials.accessToken.trim();
    if (!token || token.length > 30_000 || /[\r\n]/.test(token))
      throw new PracticePantherApiError(
        "credential_missing",
        "PracticePanther OAuth access token is missing or invalid.",
      );
    const response = await this.requester(
      new URL("/api/TimeEntry/$count", PracticePantherApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "text/plain, application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-PracticePanther/1.0",
        },
      },
    ).catch(() => {
      throw new PracticePantherApiError(
        "provider_unavailable",
        "PracticePanther could not be reached.",
      );
    });
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 65_536)
      throw new PracticePantherApiError(
        "provider_validation_error",
        "PracticePanther response exceeded 64 KB.",
      );
    if (!response.ok)
      throw new PracticePantherApiError(
        this.code(response.status),
        `PracticePanther returned HTTP ${response.status}.`,
        response.status,
      );
    const text = raw.toString("utf8").trim().replace(/^"|"$/g, "");
    if (!/^(?:0|[1-9][0-9]{0,15})$/.test(text))
      throw new PracticePantherApiError(
        "provider_validation_error",
        "PracticePanther returned an invalid authority response.",
      );
    return {
      authorized: true,
      apiVersion: PracticePantherApiAdapter.apiVersion,
      redactionStatus:
        "identity-firm-legal-practice-time-and-financial-data-excluded",
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
