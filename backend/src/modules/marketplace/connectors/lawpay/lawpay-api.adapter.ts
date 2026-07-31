import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type LawPayCredentials = { accessToken: string };

export class LawPayApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class LawPayApiAdapter {
  static readonly origin = "https://api.8am.com";
  static readonly apiVersion = "v1";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: LawPayCredentials) {
    await this.getConnectionAuthority(credentials);
    return {
      apiOrigin: LawPayApiAdapter.origin,
      platform: "8am-lawpay",
      apiVersion: LawPayApiAdapter.apiVersion,
    };
  }

  async getConnectionAuthority(credentials: LawPayCredentials) {
    const accessToken = credentials.accessToken.trim();
    if (
      !accessToken ||
      accessToken.length > 30_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new LawPayApiError(
        "credential_missing",
        "LawPay OAuth access token is missing or invalid.",
      );
    const response = await this.requester(
      new URL("/gateway-credentials", LawPayApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-LawPay/1.0",
        },
      },
    ).catch(() => {
      throw new LawPayApiError(
        "provider_unavailable",
        "LawPay could not be reached.",
      );
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 65_536)
      throw new LawPayApiError(
        "provider_validation_error",
        "LawPay response exceeded 64 KB.",
      );
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 65_536)
      throw new LawPayApiError(
        "provider_validation_error",
        "LawPay response exceeded 64 KB.",
      );
    if (!response.ok)
      throw new LawPayApiError(
        this.code(response.status),
        `LawPay returned HTTP ${response.status}.`,
        response.status,
      );
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new LawPayApiError(
        "provider_validation_error",
        "LawPay returned invalid JSON.",
      );
    }
    if (
      typeof body.application !== "string" ||
      !body.user ||
      typeof body.user !== "object" ||
      !body.merchant ||
      typeof body.merchant !== "object" ||
      !Array.isArray(body.test_accounts) ||
      !Array.isArray(body.live_accounts)
    )
      throw new LawPayApiError(
        "provider_validation_error",
        "LawPay returned an invalid gateway-credentials authority response.",
      );
    return {
      authorized: true,
      platform: "8am-lawpay",
      apiVersion: LawPayApiAdapter.apiVersion,
      redactionStatus:
        "merchant-identity-account-keys-trust-payment-and-legal-practice-data-excluded",
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
