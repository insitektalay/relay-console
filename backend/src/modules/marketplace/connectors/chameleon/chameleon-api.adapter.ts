import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type ChameleonCredentials = { accountSecret: string };

export class ChameleonApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ChameleonApiAdapter {
  private static readonly origin = "https://api.chameleon.io";
  private static readonly path = "/v3/edit/tours";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ChameleonCredentials) {
    await this.fetchTours(credentials, 1);
    return {
      credentialsVerified: true,
      exactAccountBound: true,
      tourDataReturned: false,
      profileDataReturned: false,
      writesEnabled: false,
    };
  }

  async listTours(credentials: ChameleonCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = this.object(await this.fetchTours(credentials, limit));
    if (!Array.isArray(value.tours))
      throw this.validation("Chameleon returned an invalid Tour list.");
    const tours = value.tours.slice(0, limit).map((entry) => {
      const tour = this.object(entry);
      return {
        tourId: this.scalar(tour.id, 128),
        name: this.scalar(tour.name, 256),
        style:
          tour.style === "auto" || tour.style === "manual" ? tour.style : null,
        createdAt: this.scalar(tour.created_at, 64),
        updatedAt: this.scalar(tour.updated_at, 64),
        publishedAt: this.scalar(tour.published_at, 64),
      };
    });
    const cursor = this.object(value.cursor);
    return {
      semanticReadContract: "chameleon-tour-inventory-v1",
      tours,
      returnedCount: tours.length,
      maxResults: limit,
      hasMore: typeof cursor.before === "string" && cursor.before.length > 0,
      providerRequestCount: 1,
      segmentIdsReturned: false,
      tagIdsReturned: false,
      dashboardUrlsReturned: false,
      contentSummariesReturned: false,
      audienceSummariesReturned: false,
      statsReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchTours(credentials: ChameleonCredentials, limit: number) {
    const accountSecret = this.secret(credentials.accountSecret);
    const url = new URL(
      ChameleonApiAdapter.path,
      `${ChameleonApiAdapter.origin}/`,
    );
    url.searchParams.set("limit", String(limit));
    if (
      url.origin !== ChameleonApiAdapter.origin ||
      url.pathname !== ChameleonApiAdapter.path ||
      url.searchParams.size !== 1 ||
      url.searchParams.get("limit") !== String(limit) ||
      url.hash
    )
      throw new ChameleonApiError(
        "policy_blocked",
        "Chameleon request escaped Relay's fixed Tour-inventory allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Account-Secret": accountSecret,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new ChameleonApiError(
        "provider_unavailable",
        "Chameleon API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Chameleon response exceeded Relay's 1 MB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Chameleon returned invalid JSON.");
    }
    if (!response.ok)
      throw new ChameleonApiError(
        this.errorCode(response.status),
        "Chameleon rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new ChameleonApiError(
        "credential_missing",
        "Chameleon account secret is missing.",
        401,
      );
    return result;
  }

  private limit(value: unknown) {
    if (value === undefined) return 50;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 50)
      throw this.validation("limit must be an integer from 1 to 50.");
    return Number(value);
  }

  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "credential_missing";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new ChameleonApiError("provider_validation_error", message);
  }
}
