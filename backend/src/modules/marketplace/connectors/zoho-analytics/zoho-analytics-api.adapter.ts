import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type ZohoAnalyticsCredentials = {
  accessToken: string;
  apiOrigin: string;
  accountsOrigin: string;
  userId: string;
};

const API_ORIGINS = new Set([
  "https://analyticsapi.zoho.com",
  "https://analyticsapi.zoho.eu",
  "https://analyticsapi.zoho.in",
  "https://analyticsapi.zoho.com.au",
  "https://analyticsapi.zoho.com.cn",
  "https://analyticsapi.zoho.jp",
  "https://analyticsapi.zoho.sa",
  "https://analyticsapi.zohocloud.ca",
]);
const ACCOUNTS_ORIGINS = new Set([
  "https://accounts.zoho.com",
  "https://accounts.zoho.eu",
  "https://accounts.zoho.in",
  "https://accounts.zoho.com.au",
  "https://accounts.zoho.com.cn",
  "https://accounts.zoho.jp",
  "https://accounts.zoho.sa",
  "https://accounts.zohocloud.ca",
]);

export class ZohoAnalyticsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ZohoAnalyticsApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ZohoAnalyticsCredentials) {
    const [profileBody, workspacesBody] = await Promise.all([
      this.request(
        credentials,
        credentials.accountsOrigin,
        "/oauth/user/info",
        new URLSearchParams(),
      ),
      this.request(
        credentials,
        credentials.apiOrigin,
        "/restapi/v2/workspaces",
        new URLSearchParams(),
      ),
    ]);
    this.success(workspacesBody);
    const profile = this.record(profileBody);
    const userId = this.id(
      profile.ZUID ??
        profile.zuid ??
        profile.User_Id ??
        profile.user_id ??
        profile.id,
      "user",
    );
    if (userId !== credentials.userId)
      throw new ZohoAnalyticsApiError(
        "insufficient_scope",
        "Zoho Analytics connected-user binding changed.",
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

  async listWorkspaces(
    credentials: ZohoAnalyticsCredentials,
    input: { limit?: number },
  ) {
    const limit = this.limit(input.limit);
    const body = this.success(
      await this.request(
        credentials,
        credentials.apiOrigin,
        "/restapi/v2/workspaces",
        new URLSearchParams(),
      ),
    );
    const data = this.record(body.data);
    const project = (value: unknown, ownership: "owned" | "shared") => {
      const item = this.record(value);
      return {
        workspaceId: this.id(item.workspaceId, "workspace"),
        name: this.text(item.workspaceName, 300),
        organizationId: this.id(item.orgId, "organization"),
        ownership,
        isDefault: item.isDefault === true,
      };
    };
    const owned = Array.isArray(data.ownedWorkspaces)
      ? data.ownedWorkspaces.map((v) => project(v, "owned"))
      : [];
    const shared = Array.isArray(data.sharedWorkspaces)
      ? data.sharedWorkspaces.map((v) => project(v, "shared"))
      : [];
    return { workspaces: [...owned, ...shared].slice(0, limit) };
  }

  async listViews(
    credentials: ZohoAnalyticsCredentials,
    input: { organizationId: string; workspaceId: string; limit?: number },
  ) {
    const organizationId = this.id(input.organizationId, "organization");
    const workspaceId = this.id(input.workspaceId, "workspace");
    const limit = this.limit(input.limit);
    const config = JSON.stringify({
      sortedColumn: 0,
      sortedOrder: 0,
      noOfResult: limit,
      startIndex: 1,
    });
    const body = this.success(
      await this.request(
        credentials,
        credentials.apiOrigin,
        `/restapi/v2/workspaces/${workspaceId}/views`,
        new URLSearchParams({ CONFIG: config }),
        { "ZANALYTICS-ORGID": organizationId },
      ),
    );
    const views = this.record(body.data).views;
    return {
      organizationId,
      workspaceId,
      views: (Array.isArray(views) ? views : [])
        .slice(0, limit)
        .map((value) => {
          const item = this.record(value);
          return {
            viewId: this.id(item.viewId, "view"),
            name: this.text(item.viewName, 300),
            type: this.text(item.viewType, 100) || null,
          };
        }),
    };
  }

  private async request(
    credentials: ZohoAnalyticsCredentials,
    origin: string,
    path: string,
    query: URLSearchParams,
    extraHeaders: Record<string, string> = {},
  ) {
    this.credentials(credentials);
    if (
      (origin !== credentials.apiOrigin &&
        origin !== credentials.accountsOrigin) ||
      !/^\/[A-Za-z0-9_.\/-]+$/.test(path) ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new ZohoAnalyticsApiError(
        "provider_validation_error",
        "Zoho Analytics request authority or path is invalid.",
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
        "User-Agent": "RelayConsole-ZohoAnalytics/1.0",
        ...extraHeaders,
      },
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw new ZohoAnalyticsApiError(
        "provider_validation_error",
        "Zoho Analytics response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new ZohoAnalyticsApiError(
        "provider_validation_error",
        "Zoho Analytics response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ZohoAnalyticsApiError(
        "provider_validation_error",
        "Zoho Analytics returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ZohoAnalyticsApiError(
        this.safeCode(response.status),
        `Zoho Analytics returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }
  private success(value: unknown) {
    const body = this.record(value);
    if (body.status !== "success")
      throw new ZohoAnalyticsApiError(
        "provider_validation_error",
        "Zoho Analytics rejected the metadata request.",
      );
    return body;
  }
  private credentials(value: ZohoAnalyticsCredentials) {
    if (!value.accessToken.trim())
      throw new ZohoAnalyticsApiError(
        "credential_missing",
        "Zoho Analytics access token is required.",
        401,
      );
    this.id(value.userId, "user");
    if (
      !API_ORIGINS.has(value.apiOrigin) ||
      !ACCOUNTS_ORIGINS.has(value.accountsOrigin)
    )
      throw new ZohoAnalyticsApiError(
        "provider_validation_error",
        "Zoho Analytics regional authority is not allowlisted.",
      );
  }
  private id(value: unknown, label: string) {
    const text = this.text(value, 25);
    if (!/^[1-9][0-9]{0,24}$/.test(text))
      throw new ZohoAnalyticsApiError(
        "provider_validation_error",
        `Zoho Analytics ${label} ID is invalid.`,
      );
    return text;
  }
  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim().slice(0, maximum)
        : "";
  }
  private email(value: unknown) {
    const text = this.text(value, 320).toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
