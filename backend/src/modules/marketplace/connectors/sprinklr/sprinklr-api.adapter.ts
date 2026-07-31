import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type SprinklrCredentials = {
  apiKey: string;
  accessToken: string;
  environment: string;
  workspaceId: string;
};

export class SprinklrApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SprinklrApiAdapter {
  static readonly apiOrigin = "https://api3.sprinklr.com";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: SprinklrCredentials) {
    const status = await this.getGovernanceStatus(credentials);
    return {
      apiOrigin: SprinklrApiAdapter.apiOrigin,
      environment: this.environment(credentials.environment),
      workspaceId: credentials.workspaceId,
      userType: status.userType,
    };
  }

  async getGovernanceStatus(credentials: SprinklrCredentials) {
    this.validate(credentials);
    const body = this.object(await this.get(credentials));
    const data = this.object(body.data);
    const returnedWorkspace = this.positiveId(data.workspaceId);
    if (returnedWorkspace !== credentials.workspaceId)
      throw new SprinklrApiError(
        "insufficient_scope",
        "Sprinklr token did not resolve to the bound primary workspace.",
        403,
      );
    return {
      userType: this.safeEnum(data.type),
      primaryWorkspaceConfirmed: true,
      customerBound: Boolean(this.positiveId(data.customerId)),
      redactionStatus: "identity-and-platform-data-excluded",
    };
  }

  private async get(credentials: SprinklrCredentials) {
    const env = this.environment(credentials.environment);
    const path = `${env === "production" ? "" : `/${env}`}/api/v2/me`;
    let response: Response;
    try {
      response = await this.requester(
        new URL(path, SprinklrApiAdapter.apiOrigin),
        {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${credentials.accessToken}`,
            Key: credentials.apiKey,
            "User-Agent": "RelayConsole-Sprinklr/1.0",
          },
        },
      );
    } catch (error) {
      if (error instanceof SprinklrApiError) throw error;
      throw new SprinklrApiError(
        "provider_unavailable",
        "Sprinklr could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation(
        "Sprinklr response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation(
        "Sprinklr response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("Sprinklr returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new SprinklrApiError(
        this.safeCode(response.status, raw),
        `Sprinklr returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validate(credentials: SprinklrCredentials) {
    for (const [label, value] of [
      ["API key", credentials.apiKey],
      ["access token", credentials.accessToken],
    ] as const) {
      if (!value.trim() || value.length > 30_000 || /[\r\n]/.test(value))
        throw new SprinklrApiError(
          "credential_missing",
          `A valid Sprinklr ${label} is required.`,
          401,
        );
    }
    this.environment(credentials.environment);
    if (!this.positiveId(credentials.workspaceId))
      throw this.validation("Sprinklr workspace ID is invalid.");
  }
  private environment(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "production" || /^prod[0-9]{1,2}$/.test(normalized))
      return normalized;
    throw this.validation("Sprinklr environment is invalid.");
  }
  private positiveId(value: unknown) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : typeof value === "string"
          ? value
          : "";
    return /^[1-9][0-9]{0,18}$/.test(text) ? text : null;
  }
  private safeEnum(value: unknown) {
    return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(value)
      ? value
      : null;
  }
  private object(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Obj)
      : {};
  }
  private safeCode(
    status: number,
    raw: string,
  ): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 && /developer over rate/i.test(raw))
      return "provider_rate_limited";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string, statusCode?: number) {
    return new SprinklrApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
