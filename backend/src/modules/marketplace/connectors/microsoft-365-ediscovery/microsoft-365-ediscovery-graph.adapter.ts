import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export class Microsoft365EdiscoveryGraphError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class Microsoft365EdiscoveryGraphAdapter {
  static readonly origin = "https://graph.microsoft.com";
  constructor(private readonly requester: Requester = fetch) {}

  async health(accessToken: string) {
    await this.listCases(accessToken);
    return {
      apiOrigin: Microsoft365EdiscoveryGraphAdapter.origin,
      delegatedOnly: true,
      workSchoolOnly: true,
      purviewRoleVerified: true,
    };
  }

  async listCases(accessToken: string) {
    const root = this.object(
      await this.get(accessToken, "/v1.0/security/cases/ediscoveryCases"),
    );
    const cases = this.values(root)
      .slice(0, 25)
      .map((value) => this.caseSummary(value));
    return {
      cases,
      resultCount: cases.length,
      truncated: Boolean(root["@odata.nextLink"]),
      nextPageFollowed: false,
      ...this.boundary(
        "case-descriptions-external-ids-identities-members-custodians-and-content-excluded",
      ),
    };
  }

  async getCase(accessToken: string, input: Obj) {
    const caseId = this.identifier(input.caseId, "caseId");
    const value = this.object(
      await this.get(
        accessToken,
        `/v1.0/security/cases/ediscoveryCases/${caseId}`,
      ),
    );
    return {
      case: this.caseSummary(value),
      ...this.boundary(
        "case-description-external-id-identities-members-custodians-and-content-excluded",
      ),
    };
  }

  async listSearches(accessToken: string, input: Obj) {
    const caseId = this.identifier(input.caseId, "caseId");
    const root = this.object(
      await this.get(
        accessToken,
        `/v1.0/security/cases/ediscoveryCases/${caseId}/searches`,
      ),
    );
    const searches = this.values(root)
      .slice(0, 25)
      .map((value) => ({
        id: this.id(value.id),
        displayName: this.text(value.displayName, 256),
        createdDateTime: this.date(value.createdDateTime),
        lastModifiedDateTime: this.date(value.lastModifiedDateTime),
      }));
    return {
      searches,
      resultCount: searches.length,
      truncated: Boolean(root["@odata.nextLink"]),
      nextPageFollowed: false,
      ...this.boundary(
        "search-descriptions-queries-source-scopes-identities-statistics-results-and-content-excluded",
      ),
    };
  }

  async listReviewSets(accessToken: string, input: Obj) {
    const caseId = this.identifier(input.caseId, "caseId");
    const root = this.object(
      await this.get(
        accessToken,
        `/v1.0/security/cases/ediscoveryCases/${caseId}/reviewSets`,
      ),
    );
    const reviewSets = this.values(root)
      .slice(0, 25)
      .map((value) => ({
        id: this.id(value.id),
        displayName: this.text(value.displayName, 256),
        createdDateTime: this.date(value.createdDateTime),
      }));
    return {
      reviewSets,
      resultCount: reviewSets.length,
      truncated: Boolean(root["@odata.nextLink"]),
      nextPageFollowed: false,
      ...this.boundary(
        "review-set-descriptions-queries-documents-tags-analytics-productions-and-exports-excluded",
      ),
    };
  }

  private async get(accessToken: string, path: string) {
    if (!accessToken.trim())
      throw new Microsoft365EdiscoveryGraphError(
        "credential_missing",
        "A Microsoft access token is required.",
        401,
      );
    const url = new URL(path, Microsoft365EdiscoveryGraphAdapter.origin);
    this.assertSafeUrl(url);
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Microsoft-365-eDiscovery/1.0",
        },
      });
    } catch (error) {
      if (error instanceof Microsoft365EdiscoveryGraphError) throw error;
      throw new Microsoft365EdiscoveryGraphError(
        "provider_unavailable",
        "Microsoft 365 eDiscovery could not be reached.",
      );
    }
    const raw = await response.text();
    if (
      Number(response.headers.get("content-length") ?? 0) > 1_000_000 ||
      Buffer.byteLength(raw) > 1_000_000
    )
      throw this.validation("Microsoft Graph response exceeds 1 MB.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation(
        "Microsoft Graph returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new Microsoft365EdiscoveryGraphError(
        this.code(response.status),
        `Microsoft 365 eDiscovery returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private assertSafeUrl(url: URL) {
    const safe =
      /^\/v1\.0\/security\/cases\/ediscoveryCases(?:\/[0-9a-fA-F-]{36}(?:\/(?:searches|reviewSets))?)?$/.test(
        url.pathname,
      );
    if (
      url.protocol !== "https:" ||
      url.hostname !== "graph.microsoft.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !safe
    )
      throw this.validation("Unsafe Microsoft Graph eDiscovery request.");
  }

  private identifier(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        value,
      )
    )
      throw this.validation(`A valid ${label} is required.`);
    return value;
  }
  private object(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Obj)
      : {};
  }
  private values(root: Obj): Obj[] {
    return Array.isArray(root.value)
      ? root.value.filter(
          (value): value is Obj =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
  }
  private id(value: unknown) {
    return typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value)
      ? value
      : null;
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private date(value: unknown) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value))
      ? value
      : null;
  }
  private caseSummary(value: Obj) {
    return {
      id: this.id(value.id),
      displayName: this.text(value.displayName, 256),
      status: this.text(value.status, 64),
      createdDateTime: this.date(value.createdDateTime),
      lastModifiedDateTime: this.date(value.lastModifiedDateTime),
      closedDateTime: this.date(value.closedDateTime),
    };
  }
  private boundary(redactionStatus: string) {
    return {
      delegatedOnly: true,
      workSchoolOnly: true,
      providerRoleEnforced: true,
      eDiscoveryReadAllOnly: true,
      legalContentReturned: false,
      identitiesReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
      maxResults: 25,
      maxResponseBytes: 1_000_000,
      timeoutSeconds: 30,
      automaticRetries: false,
      redactionStatus,
    };
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string, statusCode?: number) {
    return new Microsoft365EdiscoveryGraphError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
