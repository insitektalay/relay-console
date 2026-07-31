import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type TreasureDataCredentials = {
  apiKey: string;
  apiRegion: string;
};

export class TreasureDataApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TreasureDataApiAdapter {
  static readonly origins: Record<string, string> = {
    us: "https://api.treasuredata.com",
    tokyo: "https://api.treasuredata.co.jp",
    ap02: "https://api.ap02.treasuredata.com",
    eu01: "https://api.eu01.treasuredata.com",
  };

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: TreasureDataCredentials) {
    const summary = await this.getDatabaseReadinessSummary(credentials);
    return {
      apiOrigin: this.origin(credentials),
      databaseCount: summary.databaseCount,
    };
  }

  async getDatabaseReadinessSummary(credentials: TreasureDataCredentials) {
    const origin = this.origin(credentials);
    const root = this.object(
      await this.request(
        new URL("/v3/database/list?require_permissions=true", origin),
        credentials,
      ),
    );
    if (!Array.isArray(root.databases))
      throw new TreasureDataApiError(
        "provider_validation_error",
        "Treasure Data returned an unexpected database-list shape.",
      );
    let deleteProtectedCount = 0;
    for (const value of root.databases) {
      if (this.object(value).delete_protected === true) deleteProtectedCount++;
    }
    return {
      databaseCount: root.databases.length,
      deleteProtectedCount,
      redactionStatus:
        "database-identity-record-count-permission-table-schema-query-job-and-customer-data-excluded",
    };
  }

  private async request(url: URL, credentials: TreasureDataCredentials) {
    this.validate(credentials);
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `TD1 ${credentials.apiKey}`,
          "User-Agent": "RelayConsole-TreasureData/1.0",
        },
      });
    } catch (error) {
      if (error instanceof TreasureDataApiError) throw error;
      throw new TreasureDataApiError(
        "provider_unavailable",
        "Treasure Data could not be reached.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 1_000_000)
      throw new TreasureDataApiError(
        "provider_validation_error",
        "Treasure Data response exceeds 1 MB.",
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new TreasureDataApiError(
        "provider_validation_error",
        "Treasure Data returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new TreasureDataApiError(
        this.code(response.status),
        `Treasure Data returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private origin(credentials: TreasureDataCredentials) {
    this.validate(credentials);
    return TreasureDataApiAdapter.origins[credentials.apiRegion.toLowerCase()];
  }

  private validate(credentials: TreasureDataCredentials) {
    if (
      !TreasureDataApiAdapter.origins[credentials.apiRegion.toLowerCase()] ||
      !credentials.apiKey.trim() ||
      credentials.apiKey.length > 30_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new TreasureDataApiError(
        "credential_missing",
        "A valid Treasure Data region and API key are required.",
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
