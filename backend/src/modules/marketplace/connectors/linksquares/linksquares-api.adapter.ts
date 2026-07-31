import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type LinkSquaresCredentials = { apiKey: string };

export class LinkSquaresApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class LinkSquaresApiAdapter {
  private static readonly ORIGIN = "https://api.linksquares.com";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: LinkSquaresCredentials) {
    const apiKey = this.apiKey(credentials);
    const value = this.object(
      await this.fetchJson(apiKey, "/api/analyze/v1/me"),
    );
    if (value.status !== "up")
      throw new LinkSquaresApiError(
        "connection_not_ready",
        "LinkSquares did not report the Analyze API as available.",
        409,
      );
    return {
      credentialValid: true,
      providerStatus: "up",
      providerRequestCount: 1,
      broadAdministratorKey: true,
      userIdentityReturned: false,
      writesEnabled: false,
    };
  }

  async listAgreementTypes(
    credentials: LinkSquaresCredentials,
    input: JsonObject,
  ) {
    const apiKey = this.apiKey(credentials);
    const limit = this.limit(input.limit);
    const value = await this.fetchJson(
      apiKey,
      "/api/analyze/v1/agreement_types",
    );
    const root = this.object(value);
    const types = Array.isArray(value)
      ? value
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(root.agreement_types)
          ? root.agreement_types
          : [];
    return {
      semanticReadContract: "linksquares-agreement-type-list-v1",
      agreementTypes: types.slice(0, limit).map((entry) => {
        const type = this.object(entry);
        return {
          agreementTypeId: this.scalar(type.id, 128),
          name: this.scalar(type.name, 200),
        };
      }),
      returnedCount: Math.min(types.length, limit),
      maxResults: limit,
      providerRequestCount: 1,
      agreementDataReturned: false,
      termsReturned: false,
      tagsReturned: false,
      filesReturned: false,
      peopleReturned: false,
      rawProviderResponseReturned: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchJson(apiKey: string, path: string) {
    const url = new URL(path, `${LinkSquaresApiAdapter.ORIGIN}/`);
    if (
      url.origin !== LinkSquaresApiAdapter.ORIGIN ||
      !["/api/analyze/v1/me", "/api/analyze/v1/agreement_types"].includes(
        url.pathname,
      ) ||
      url.search ||
      url.hash
    )
      throw new LinkSquaresApiError(
        "policy_blocked",
        "LinkSquares request escaped Relay's fixed Analyze metadata allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", "x-api-key": apiKey },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new LinkSquaresApiError(
        "provider_unavailable",
        "LinkSquares could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation(
        "LinkSquares response exceeded Relay's 1 MB bound.",
      );
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("LinkSquares returned invalid JSON.");
    }
    if (!response.ok)
      throw new LinkSquaresApiError(
        this.errorCode(response.status),
        "LinkSquares rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private apiKey(credentials: LinkSquaresCredentials) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new LinkSquaresApiError(
        "credential_missing",
        "LinkSquares API key is missing.",
        401,
      );
    return apiKey;
  }

  private limit(value: unknown) {
    if (value === undefined) return 100;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 100
    )
      throw this.validation("limit must be an integer from 1 to 100.");
    return Number(value);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private scalar(value: unknown, max: number) {
    if (typeof value === "string" && value) return value.slice(0, max);
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    return null;
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new LinkSquaresApiError("provider_validation_error", message);
  }
}
