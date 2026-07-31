import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type MentionCredentials = { accessToken: string; accountId: string };

export class MentionApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class MentionApiAdapter {
  static readonly apiOrigin = "https://api.mention.net";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: MentionCredentials) {
    const account = this.accountObject(
      await this.get(credentials, `/api/accounts/${credentials.accountId}`),
    );
    if (this.resourceId(account) !== credentials.accountId)
      throw new MentionApiError(
        "insufficient_scope",
        "Mention token cannot access the bound account.",
        403,
      );
    return {
      apiOrigin: MentionApiAdapter.apiOrigin,
      accountId: credentials.accountId,
    };
  }

  async getAccountStatus(credentials: MentionCredentials) {
    const account = this.accountObject(
      await this.get(credentials, `/api/accounts/${credentials.accountId}`),
    );
    if (this.resourceId(account) !== credentials.accountId)
      throw new MentionApiError(
        "insufficient_scope",
        "Mention token cannot access the bound account.",
        403,
      );
    return {
      accountId: credentials.accountId,
      languageCode: this.safeEnum(account.language_code),
      timezone: this.safeTimezone(account.timezone),
      redactionStatus: "account-identity-excluded",
    };
  }

  async listAlerts(credentials: MentionCredentials) {
    const body = this.record(
      await this.get(
        credentials,
        `/api/accounts/${credentials.accountId}/alerts?limit=25`,
      ),
    );
    const source = Array.isArray(body.alerts) ? body.alerts : [];
    return {
      accountId: credentials.accountId,
      alerts: source
        .slice(0, 25)
        .map((value) => this.alert(value))
        .filter((value) => value.alertId),
      redactionStatus: "alert-identity-and-content-excluded",
    };
  }

  private async get(credentials: MentionCredentials, path: string) {
    this.validate(credentials);
    const allowed =
      path === `/api/accounts/${credentials.accountId}` ||
      path === `/api/accounts/${credentials.accountId}/alerts?limit=25`;
    if (!allowed)
      throw this.validation("Mention API path is outside the Relay allowlist.");
    let response: Response;
    try {
      response = await this.requester(
        new URL(path, MentionApiAdapter.apiOrigin),
        {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Accept-Version": "1.19",
            Authorization: `Bearer ${credentials.accessToken}`,
            "User-Agent": "RelayConsole-Mention/1.0",
          },
        },
      );
    } catch (error) {
      if (error instanceof MentionApiError) throw error;
      throw new MentionApiError(
        "provider_unavailable",
        "Mention could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation(
        "Mention response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation(
        "Mention response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("Mention returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new MentionApiError(
        this.safeCode(response.status),
        `Mention returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validate(credentials: MentionCredentials) {
    if (
      !credentials.accessToken.trim() ||
      credentials.accessToken.length > 30_000 ||
      /[\r\n]/.test(credentials.accessToken)
    )
      throw new MentionApiError(
        "credential_missing",
        "A valid Mention access token is required.",
        401,
      );
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(credentials.accountId))
      throw this.validation("Mention account ID is invalid.");
  }
  private accountObject(value: unknown) {
    const root = this.record(value);
    return this.record(root.account ?? root);
  }
  private alert(value: unknown) {
    const item = this.record(value);
    const query = this.record(item.query);
    return {
      alertId: this.resourceId(item),
      queryType: this.safeEnum(query.type),
      indexVersion: this.safeNumber(item.index_version),
    };
  }
  private resourceId(value: unknown) {
    const item = this.record(value),
      candidate = item.id;
    if (typeof candidate === "number" && Number.isSafeInteger(candidate))
      return String(candidate);
    const text = typeof candidate === "string" ? candidate : "";
    return /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : null;
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private safeEnum(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value)
      ? value
      : null;
  }
  private safeTimezone(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_+./-]{1,64}$/.test(value)
      ? value
      : null;
  }
  private safeNumber(value: unknown) {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string, statusCode?: number) {
    return new MentionApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
