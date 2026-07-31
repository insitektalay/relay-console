import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type ClioManageCredentials = { accessToken: string };

export class ClioManageApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ClioManageApiAdapter {
  static readonly origin = "https://app.clio.com";
  static readonly apiVersion = "4.0.13";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ClioManageCredentials) {
    await this.getConnectionAuthority(credentials);
    return { apiOrigin: ClioManageApiAdapter.origin, apiRegion: "us" };
  }

  async getConnectionAuthority(credentials: ClioManageCredentials) {
    const root = await this.get(
      credentials,
      "/api/v4/users/who_am_i?fields=id,enabled",
    );
    const user = this.record(root.data);
    if (!this.positiveId(user.id))
      throw new ClioManageApiError(
        "provider_validation_error",
        "Clio Manage returned no valid authenticated-user authority.",
      );
    return {
      authorized: true,
      userEnabled: user.enabled === true,
      apiRegion: "us",
      apiVersion: ClioManageApiAdapter.apiVersion,
      redactionStatus: "identity-and-legal-practice-data-excluded",
    };
  }

  private async get(credentials: ClioManageCredentials, path: string) {
    const token = credentials.accessToken.trim();
    if (!token || token.length > 30_000 || /[\r\n]/.test(token))
      throw new ClioManageApiError(
        "credential_missing",
        "Clio Manage OAuth access token is missing or invalid.",
      );
    const response = await this.requester(
      new URL(path, ClioManageApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-API-VERSION": ClioManageApiAdapter.apiVersion,
          "User-Agent": "RelayConsole-ClioManage/1.0",
        },
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new ClioManageApiError(
        "provider_validation_error",
        "Clio Manage response exceeded 1 MB.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ClioManageApiError(
        "provider_validation_error",
        "Clio Manage returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ClioManageApiError(
        this.code(response.status),
        `Clio Manage returned HTTP ${response.status}.`,
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
