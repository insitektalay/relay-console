import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type ZohoPeopleStructureKind = "entities" | "units" | "divisions";

export type ZohoPeopleCredentials = {
  accessToken: string;
  apiOrigin: string;
  accountsOrigin: string;
  userId: string;
};

const ALLOWED_API_ORIGINS = new Set([
  "https://www.zohoapis.com",
  "https://www.zohoapis.eu",
  "https://www.zohoapis.in",
  "https://www.zohoapis.com.au",
  "https://www.zohoapis.jp",
  "https://www.zohoapis.ca",
  "https://www.zohoapis.com.cn",
  "https://www.zohoapis.ae",
  "https://www.zohoapis.sa",
  "https://www.zohoapis.uk",
]);

const ALLOWED_ACCOUNTS_ORIGINS = new Set([
  "https://accounts.zoho.com",
  "https://accounts.zoho.eu",
  "https://accounts.zoho.in",
  "https://accounts.zoho.com.au",
  "https://accounts.zoho.jp",
  "https://accounts.zohocloud.ca",
  "https://accounts.zoho.com.cn",
  "https://accounts.zoho.ae",
  "https://accounts.zoho.sa",
  "https://accounts.zoho.uk",
]);

export class ZohoPeopleApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ZohoPeopleApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ZohoPeopleCredentials) {
    const [profileBody] = await Promise.all([
      this.request(
        credentials,
        credentials.accountsOrigin,
        "/oauth/user/info",
        new URLSearchParams(),
      ),
      this.request(
        credentials,
        credentials.apiOrigin,
        "/people/api/v3/orgstructure/entities",
        new URLSearchParams({ offset: "1", limit: "1" }),
      ),
    ]);
    const profile = this.record(profileBody);
    const userId = this.profileUserId(profile);
    if (userId !== credentials.userId)
      throw new ZohoPeopleApiError(
        "insufficient_scope",
        "Zoho People connected-user binding changed.",
        403,
      );
    return {
      userId,
      displayName:
        this.text(
          profile.Display_Name ?? profile.display_name ?? profile.name,
          200,
        ) || null,
      email:
        this.email(profile.Email ?? profile.email ?? profile.Email_Id) || null,
      apiOrigin: credentials.apiOrigin,
      accountsOrigin: credentials.accountsOrigin,
    };
  }

  async listStructure(
    credentials: ZohoPeopleCredentials,
    input: { kind: ZohoPeopleStructureKind; limit?: number },
  ) {
    const kind = this.kind(input.kind);
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.request(
        credentials,
        credentials.apiOrigin,
        `/people/api/v3/orgstructure/${kind}`,
        new URLSearchParams({ offset: "1", limit: String(limit) }),
      ),
    );
    const data = Array.isArray(body.data) ? body.data : [];
    return {
      kind,
      records: data.slice(0, limit).map((value) => this.structure(value)),
      hasMore: body.has_more === true,
    };
  }

  async getStructure(
    credentials: ZohoPeopleCredentials,
    input: { kind: ZohoPeopleStructureKind; recordId: string },
  ) {
    const kind = this.kind(input.kind);
    const recordId = this.positiveId(input.recordId, "record");
    return {
      kind,
      record: this.structure(
        await this.request(
          credentials,
          credentials.apiOrigin,
          `/people/api/v3/orgstructure/${kind}/${recordId}`,
          new URLSearchParams(),
        ),
      ),
    };
  }

  private async request(
    credentials: ZohoPeopleCredentials,
    origin: string,
    path: string,
    query: URLSearchParams,
  ) {
    this.credentials(credentials);
    if (
      (origin !== credentials.apiOrigin &&
        origin !== credentials.accountsOrigin) ||
      !/^\/[A-Za-z0-9_/-]+$/.test(path) ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new ZohoPeopleApiError(
        "provider_validation_error",
        "Zoho People request authority or path is invalid.",
      );
    const url = new URL(path, `${origin}/`);
    url.search = query.toString();
    const response = await this.requester(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Zoho-oauthtoken ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-ZohoPeople/1.0",
      },
    });
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw new ZohoPeopleApiError(
        "provider_validation_error",
        "Zoho People response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new ZohoPeopleApiError(
        "provider_validation_error",
        "Zoho People response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ZohoPeopleApiError(
        "provider_validation_error",
        "Zoho People returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ZohoPeopleApiError(
        this.safeCode(response.status),
        `Zoho People returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private structure(value: unknown) {
    const item = this.record(value);
    const parent = this.record(item.parent_division);
    return {
      id: this.positiveId(item.zoho_id ?? item.id, "record"),
      name: this.text(item.name, 300),
      code: this.text(item.zp_code, 100) || null,
      parentDivision:
        Object.keys(parent).length > 0
          ? {
              id: this.positiveId(
                parent.zoho_id ?? parent.id,
                "parent division",
              ),
              name: this.text(parent.name, 300),
            }
          : null,
    };
  }

  private credentials(credentials: ZohoPeopleCredentials) {
    if (!credentials.accessToken.trim())
      throw new ZohoPeopleApiError(
        "credential_missing",
        "Zoho People access token is required.",
        401,
      );
    this.positiveId(credentials.userId, "user");
    if (
      !ALLOWED_API_ORIGINS.has(credentials.apiOrigin) ||
      !ALLOWED_ACCOUNTS_ORIGINS.has(credentials.accountsOrigin)
    )
      throw new ZohoPeopleApiError(
        "provider_validation_error",
        "Zoho People regional authority is not allowlisted.",
      );
  }

  private profileUserId(profile: JsonObject) {
    return this.positiveId(
      profile.ZUID ??
        profile.zuid ??
        profile.User_Id ??
        profile.user_id ??
        profile.id,
      "user",
    );
  }

  private kind(value: unknown): ZohoPeopleStructureKind {
    if (value === "entities" || value === "units" || value === "divisions")
      return value;
    throw new ZohoPeopleApiError(
      "provider_validation_error",
      "Zoho People structure kind must be entities, units, or divisions.",
    );
  }

  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
  }

  private positiveId(value: unknown, label: string) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.text(value, 25);
    if (!/^[1-9][0-9]{0,24}$/.test(text))
      throw new ZohoPeopleApiError(
        "provider_validation_error",
        `Zoho People ${label} ID is invalid.`,
      );
    return text;
  }

  private email(value: unknown) {
    const text = this.text(value, 320).toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private text(value: unknown, maximum: number) {
    if (typeof value === "number" && Number.isSafeInteger(value))
      return String(value);
    return typeof value === "string" ? value.trim().slice(0, maximum) : "";
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
