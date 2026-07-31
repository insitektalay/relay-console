import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type ClioGrowCredentials = { accessToken: string };

export class ClioGrowApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ClioGrowApiAdapter {
  static readonly origin = "https://api.clio.com";
  static readonly apiVersion = "v2";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ClioGrowCredentials) {
    await this.getConnectionAuthority(credentials);
    return { apiOrigin: ClioGrowApiAdapter.origin, apiRegion: "us" };
  }

  async getConnectionAuthority(credentials: ClioGrowCredentials) {
    const root = await this.get(credentials, "/grow/users/who_am_i");
    const user = this.record(root.data);
    const account = this.record(user.account);
    if (!this.positiveId(user.id) || !this.positiveId(account.id))
      throw new ClioGrowApiError(
        "provider_validation_error",
        "Clio Grow returned no valid user and account authority.",
      );
    return {
      authorized: true,
      apiRegion: "us",
      apiVersion: ClioGrowApiAdapter.apiVersion,
      redactionStatus: "identity-firm-and-legal-intake-data-excluded",
    };
  }

  private async get(credentials: ClioGrowCredentials, path: string) {
    const token = credentials.accessToken.trim();
    if (!token || token.length > 30_000 || /[\r\n]/.test(token))
      throw new ClioGrowApiError(
        "credential_missing",
        "Clio Grow OAuth access token is missing or invalid.",
      );
    const response = await this.requester(
      new URL(path, ClioGrowApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-ClioGrow/1.0",
        },
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new ClioGrowApiError(
        "provider_validation_error",
        "Clio Grow response exceeded 1 MB.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ClioGrowApiError(
        "provider_validation_error",
        "Clio Grow returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ClioGrowApiError(
        this.code(response.status),
        `Clio Grow returned HTTP ${response.status}.`,
        response.status,
      );
    return this.record(body);
  }

  private record(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Obj)
      : {};
  }

  private positiveId(value: unknown) {
    return /^(?:[1-9][0-9]{0,18})$/.test(String(value ?? ""));
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
