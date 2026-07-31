import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type SpotDraftCredentials = { clientId: string; clientSecret: string };

export class SpotDraftApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SpotDraftApiAdapter {
  private static readonly ORIGIN = "https://api.spotdraft.com";
  private static readonly ROLES_PATH = "/v2.1/public/auth/roles/list";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: SpotDraftCredentials) {
    await this.fetchRoles(credentials);
    return {
      clientCredentialsVerified: true,
      basicAuthorizationUsed: true,
      providerRequestCount: 1,
      userDataReturned: false,
      contractDataReturned: false,
      writesEnabled: false,
    };
  }

  async listRoles(credentials: SpotDraftCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = await this.fetchRoles(credentials);
    const root = this.object(value);
    const roles = Array.isArray(value)
      ? value
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(root.results)
          ? root.results
          : Array.isArray(root.roles)
            ? root.roles
            : [];
    return {
      semanticReadContract: "spotdraft-role-list-v1",
      roles: roles.slice(0, limit).map((entry) => {
        const role = this.object(entry);
        return {
          roleId: this.scalar(role.id ?? role.role_id, 128),
          name: this.scalar(role.name ?? role.role_name, 200),
        };
      }),
      returnedCount: Math.min(roles.length, limit),
      maxResults: limit,
      providerRequestCount: 1,
      usersReturned: false,
      membersReturned: false,
      contractsReturned: false,
      documentsReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchRoles(credentials: SpotDraftCredentials) {
    this.requireCredentials(credentials);
    const url = new URL(
      SpotDraftApiAdapter.ROLES_PATH,
      `${SpotDraftApiAdapter.ORIGIN}/`,
    );
    if (
      url.origin !== SpotDraftApiAdapter.ORIGIN ||
      url.pathname !== SpotDraftApiAdapter.ROLES_PATH ||
      url.search ||
      url.hash
    )
      throw new SpotDraftApiError(
        "policy_blocked",
        "SpotDraft request escaped Relay's fixed role-metadata allowlist.",
      );
    const basic = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
      "utf8",
    ).toString("base64");
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${basic}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new SpotDraftApiError(
        "provider_unavailable",
        "SpotDraft could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("SpotDraft response exceeded Relay's 1 MB bound.");
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("SpotDraft returned invalid JSON.");
    }
    if (!response.ok)
      throw new SpotDraftApiError(
        this.errorCode(response.status),
        "SpotDraft rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private requireCredentials(credentials: SpotDraftCredentials) {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret;
    if (
      !clientId ||
      clientId.length > 1_000 ||
      clientId.includes(":") ||
      !clientSecret ||
      clientSecret.length > 20_000
    )
      throw new SpotDraftApiError(
        "credential_missing",
        "SpotDraft client credentials are missing or invalid.",
        401,
      );
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
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new SpotDraftApiError("provider_validation_error", message);
  }
}
