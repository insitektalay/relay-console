import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type KhorosCredentials = { accessToken: string; companyId: string };

export class KhorosApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class KhorosApiAdapter {
  static readonly apiOrigin = "https://api.spredfast.com";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: KhorosCredentials) {
    const authority = await this.getCompanyAuthority(credentials);
    return {
      apiOrigin: KhorosApiAdapter.apiOrigin,
      companyId: authority.companyId,
      environment: authority.environment,
    };
  }

  async getCompanyAuthority(credentials: KhorosCredentials) {
    this.validate(credentials);
    const root = this.object(await this.get(credentials));
    const data = this.object(root.data);
    const companies = Array.isArray(data.companies) ? data.companies : [];
    const company = companies
      .slice(0, 100)
      .map((value) => this.object(value))
      .find((value) => this.resourceId(value.id) === credentials.companyId);
    if (!company)
      throw new KhorosApiError(
        "insufficient_scope",
        "Khoros Marketing token cannot access the bound company.",
        403,
      );
    return {
      companyId: credentials.companyId,
      environment: this.safeEnvironment(company.environment),
      redactionStatus: "user-and-company-identity-excluded",
    };
  }

  private async get(credentials: KhorosCredentials) {
    let response: Response;
    try {
      response = await this.requester(
        new URL("/v2/me", KhorosApiAdapter.apiOrigin),
        {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${credentials.accessToken}`,
            "User-Agent": "RelayConsole-Khoros/1.0",
          },
        },
      );
    } catch (error) {
      if (error instanceof KhorosApiError) throw error;
      throw new KhorosApiError(
        "provider_unavailable",
        "Khoros could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation("Khoros response exceeds the 1 MB Relay boundary.");
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation("Khoros response exceeds the 1 MB Relay boundary.");
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("Khoros returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new KhorosApiError(
        this.safeCode(response.status),
        `Khoros returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validate(credentials: KhorosCredentials) {
    if (
      !credentials.accessToken.trim() ||
      credentials.accessToken.length > 30_000 ||
      /[\r\n]/.test(credentials.accessToken)
    )
      throw new KhorosApiError(
        "credential_missing",
        "A valid Khoros Marketing access token is required.",
        401,
      );
    if (!this.resourceId(credentials.companyId))
      throw this.validation("Khoros Marketing company ID is invalid.");
  }
  private resourceId(value: unknown) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : typeof value === "string"
          ? value
          : "";
    return /^[1-9][0-9]{0,18}$/.test(text) ? text : null;
  }
  private safeEnvironment(value: unknown) {
    return typeof value === "string" &&
      /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value)
      ? value
      : null;
  }
  private object(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Obj)
      : {};
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string, statusCode?: number) {
    return new KhorosApiError("provider_validation_error", message, statusCode);
  }
}
