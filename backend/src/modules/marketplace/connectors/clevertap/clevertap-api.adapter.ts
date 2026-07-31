import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type CleverTapCredentials = {
  accountId: string;
  passcode: string;
  region: string;
  profileIdentity: string;
};

export class CleverTapApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CleverTapApiAdapter {
  static readonly regionOrigins: Record<string, string> = {
    eu1: "https://api.clevertap.com",
    in1: "https://in1.api.clevertap.com",
    sg1: "https://sg1.api.clevertap.com",
    us1: "https://us1.api.clevertap.com",
    aps3: "https://aps3.api.clevertap.com",
    mec1: "https://mec1.api.clevertap.com",
  };
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: CleverTapCredentials) {
    await this.getBoundUserProfile(credentials);
    return {
      apiOrigin: this.origin(credentials.region),
      region: credentials.region,
      accountIdSuffix: credentials.accountId.slice(-8),
    };
  }

  async getBoundUserProfile(credentials: CleverTapCredentials) {
    this.validate(credentials);
    const origin = this.origin(credentials.region);
    const url = new URL("/1/profile.json", origin);
    url.searchParams.set("identity", credentials.profileIdentity);
    const root = this.object(await this.get(url, credentials));
    if (root.status !== "success")
      throw this.validation("CleverTap returned an unsuccessful profile response.");
    if (root.record === null)
      throw this.validation("The bound CleverTap profile was not found.", 404);
    const record = this.object(root.record);
    if (!Object.keys(record).length)
      throw this.validation("CleverTap returned an invalid profile record.");
    return {
      profileReference: "connection-bound-identity",
      name: this.safeString(record.name, 256),
      email: this.safeString(record.email, 320),
      events: this.safeEvents(record.events),
      platforms: this.safePlatforms(record.platformInfo),
      customPropertyKeys: this.safeKeys(record.profileData, 50),
      redactionStatus:
        "lookup-identity-custom-values-device-tokens-and-object-ids-excluded",
    };
  }

  private async get(url: URL, credentials: CleverTapCredentials) {
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-CleverTap-Account-Id": credentials.accountId,
          "X-CleverTap-Passcode": credentials.passcode,
          "User-Agent": "RelayConsole-CleverTap/1.0",
        },
      });
    } catch (error) {
      if (error instanceof CleverTapApiError) throw error;
      throw new CleverTapApiError(
        "provider_unavailable",
        "CleverTap could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation("CleverTap response exceeds the 1 MB Relay boundary.");
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation("CleverTap response exceeds the 1 MB Relay boundary.");
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("CleverTap returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new CleverTapApiError(
        this.safeCode(response.status),
        `CleverTap returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validate(credentials: CleverTapCredentials) {
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(credentials.accountId))
      throw new CleverTapApiError(
        "credential_missing",
        "A valid CleverTap Account ID is required.",
        401,
      );
    if (
      !credentials.passcode.trim() ||
      credentials.passcode.length > 2_048 ||
      /[\r\n]/.test(credentials.passcode)
    )
      throw new CleverTapApiError(
        "credential_missing",
        "A valid CleverTap API passcode is required.",
        401,
      );
    this.origin(credentials.region);
    if (
      !credentials.profileIdentity.trim() ||
      credentials.profileIdentity.length > 256 ||
      /[\u0000-\u001F\u007F]/.test(credentials.profileIdentity)
    )
      throw this.validation("CleverTap profile identity is invalid.");
  }

  private origin(region: string) {
    const origin = CleverTapApiAdapter.regionOrigins[region];
    if (!origin) throw this.validation("CleverTap region is not allowlisted.");
    return origin;
  }

  private safeEvents(value: unknown) {
    return Object.entries(this.object(value))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 25)
      .map(([name, raw]) => {
        const event = this.object(raw);
        return {
          name: name.slice(0, 128),
          count: this.safeInteger(event.count),
          firstSeen: this.safeInteger(event.first_seen),
          lastSeen: this.safeInteger(event.last_seen),
        };
      });
  }

  private safePlatforms(value: unknown) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.slice(0, 50).map((item) => this.safeString(this.object(item).platform, 64)).filter((item): item is string => Boolean(item)))].slice(0, 10);
  }

  private safeKeys(value: unknown, limit: number) {
    return Object.keys(this.object(value))
      .filter((key) => key.length > 0)
      .sort()
      .slice(0, limit)
      .map((key) => key.slice(0, 128));
  }

  private safeString(value: unknown, max: number) {
    return typeof value === "string" && value.length <= max ? value : null;
  }

  private safeInteger(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
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
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string, statusCode?: number) {
    return new CleverTapApiError("provider_validation_error", message, statusCode);
  }
}
