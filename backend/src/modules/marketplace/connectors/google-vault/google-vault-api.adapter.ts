import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = typeof fetch;

export class GoogleVaultApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleVaultApiAdapter {
  private readonly apiOrigin = "https://vault.googleapis.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(accessToken: string) {
    await this.request(accessToken, "/v1/matters", {
      pageSize: "1",
      view: "BASIC",
    });
    return {
      apiOrigin: this.apiOrigin,
      readOnlyScope: "https://www.googleapis.com/auth/ediscovery.readonly",
    };
  }

  async listMatters(accessToken: string, input: JsonObject) {
    const maxResults = this.limit(input.maxResults, 10);
    const state = this.state(input.state);
    const value = await this.request(accessToken, "/v1/matters", {
      pageSize: String(maxResults),
      view: "BASIC",
      ...(state ? { state } : {}),
    });
    const matters = this.array(value.matters)
      .slice(0, maxResults)
      .map((row) => this.matter(row));
    return {
      matters,
      count: matters.length,
      nextPageTokenPresent: Boolean(this.text(value.nextPageToken)),
      nextPageFollowed: false,
      providerRequestCount: 1,
      redactionStatus:
        "collaborators-permissions-evidence-content-identities-and-raw-payload-excluded",
    };
  }

  async getMatterOverview(accessToken: string, input: JsonObject) {
    const matterId = this.id(input.matterId, "matterId");
    const maxResults = this.limit(input.maxResultsPerResource, 10);
    const base = `/v1/matters/${matterId}`;
    const [matterValue, holdsValue, exportsValue, queriesValue] =
      await Promise.all([
        this.request(accessToken, base, { view: "BASIC" }),
        this.request(accessToken, `${base}/holds`, {
          pageSize: String(maxResults),
          view: "BASIC",
        }),
        this.request(accessToken, `${base}/exports`, {
          pageSize: String(maxResults),
        }),
        this.request(accessToken, `${base}/savedQueries`, {
          pageSize: String(maxResults),
        }),
      ]);
    return {
      matter: this.matter(matterValue),
      holds: this.array(holdsValue.holds)
        .slice(0, maxResults)
        .map((row) => this.hold(row)),
      exports: this.array(exportsValue.exports)
        .slice(0, maxResults)
        .map((row) => this.exportMetadata(row)),
      savedQueries: this.array(queriesValue.savedQueries)
        .slice(0, maxResults)
        .map((row) => this.savedQuery(row)),
      nextPageTokenPresent: {
        holds: Boolean(this.text(holdsValue.nextPageToken)),
        exports: Boolean(this.text(exportsValue.nextPageToken)),
        savedQueries: Boolean(this.text(queriesValue.nextPageToken)),
      },
      nextPageFollowed: false,
      providerRequestCount: 4,
      redactionStatus:
        "held-accounts-collaborators-query-terms-export-files-storage-urls-evidence-content-and-raw-payload-excluded",
    };
  }

  private async request(
    accessToken: string,
    path: string,
    query: Record<string, string>,
  ): Promise<JsonObject> {
    if (
      !accessToken ||
      accessToken.length > 20_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new GoogleVaultApiError(
        "credential_missing",
        "A valid Google OAuth access token is required.",
        401,
      );
    const url = new URL(`${this.apiOrigin}${path}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-GoogleVault/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new GoogleVaultApiError(
        "provider_unavailable",
        "Google Vault could not be reached.",
        502,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw new GoogleVaultApiError(
        "provider_validation_error",
        "Google Vault response exceeded 1 MB.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new GoogleVaultApiError(
        "provider_validation_error",
        "Google Vault response exceeded 1 MB.",
      );
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw new GoogleVaultApiError(
        "provider_validation_error",
        "Google Vault returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new GoogleVaultApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403 || response.status === 404
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        response.status === 429
          ? "Google Vault rate limit reached; retry later."
          : "Google Vault rejected the bounded read-only request.",
        response.status,
      );
    return this.object(value);
  }

  private matter(value: unknown) {
    const row = this.object(value);
    return {
      matterId: this.text(row.matterId),
      name: this.shortText(row.name, 500),
      state: this.text(row.state),
      createTime: this.text(row.createTime),
      updateTime: this.text(row.updateTime),
    };
  }

  private hold(value: unknown) {
    const row = this.object(value);
    return {
      holdId: this.text(row.holdId),
      name: this.shortText(row.name, 500),
      corpus: this.text(row.corpus),
      updateTime: this.text(row.updateTime),
    };
  }

  private exportMetadata(value: unknown) {
    const row = this.object(value);
    return {
      id: this.text(row.id),
      name: this.shortText(row.name, 500),
      status: this.text(row.status),
      createTime: this.text(row.createTime),
      requesterIdentityReturned: false,
      evidenceFilesReturned: false,
    };
  }

  private savedQuery(value: unknown) {
    const row = this.object(value);
    return {
      savedQueryId: this.text(row.savedQueryId),
      displayName: this.shortText(row.displayName, 500),
      createTime: this.text(row.createTime),
      queryTermsReturned: false,
    };
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown): string | null {
    return typeof value === "string" && value.length <= 10_000 ? value : null;
  }

  private shortText(value: unknown, max: number): string | null {
    const result = this.text(value);
    return result && result.length <= max ? result : null;
  }

  private id(value: unknown, field: string): string {
    const result = this.text(value);
    if (!result || !/^[A-Za-z0-9_-]{1,200}$/.test(result))
      throw new GoogleVaultApiError(
        "provider_validation_error",
        `${field} is invalid.`,
      );
    return result;
  }

  private state(value: unknown): string | null {
    if (value == null || value === "") return null;
    const result = this.text(value);
    if (!result || !["OPEN", "CLOSED", "DELETED"].includes(result))
      throw new GoogleVaultApiError(
        "provider_validation_error",
        "state must be OPEN, CLOSED, or DELETED.",
      );
    return result;
  }

  private limit(value: unknown, fallback: number): number {
    const result = value == null ? fallback : Number(value);
    if (!Number.isInteger(result) || result < 1 || result > 25)
      throw new GoogleVaultApiError(
        "provider_validation_error",
        "result limit must be between 1 and 25.",
      );
    return result;
  }
}
