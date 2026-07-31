import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type SproutSocialCredentials = {
  clientId: string;
  clientSecret: string;
};
export class SproutSocialApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export class SproutSocialApiAdapter {
  static readonly apiOrigin = "https://api.sproutsocial.com";
  static readonly tokenUrl =
    "https://identity.sproutsocial.com/oauth2/84e39c75-d770-45d9-90a9-7b79e3037d2c/v1/token";
  private readonly tokens = new Map<
    string,
    { value: string; expiresAt: number }
  >();
  constructor(private readonly requester: Requester = fetch) {}
  async health(c: SproutSocialCredentials) {
    const result = await this.customers(c);
    return {
      apiOrigin: SproutSocialApiAdapter.apiOrigin,
      accessibleCustomerCount: result.customerIds.length,
      scope: "organization_id",
    };
  }
  async customers(c: SproutSocialCredentials) {
    const root = await this.get(c, "/v1/metadata/client");
    return {
      customerIds: this.array(root.data)
        .slice(0, 25)
        .map((v) => this.positive(this.object(v).customer_id))
        .filter((v): v is string => Boolean(v)),
    };
  }
  async profiles(c: SproutSocialCredentials, customerId: string) {
    const id = this.requiredCustomer(customerId),
      root = await this.get(c, `/v1/${id}/metadata/customer`);
    return {
      customerId: id,
      profiles: this.array(root.data)
        .slice(0, 25)
        .map((v) => {
          const o = this.object(v);
          return {
            customerProfileId: this.positive(o.customer_profile_id),
            networkType: this.safeText(o.network_type, 40),
            groupCount: this.array(o.groups).length,
          };
        })
        .filter((v) => v.customerProfileId),
    };
  }
  async groups(c: SproutSocialCredentials, customerId: string) {
    const id = this.requiredCustomer(customerId),
      root = await this.get(c, `/v1/${id}/metadata/customer/groups`);
    return {
      customerId: id,
      groupIds: this.array(root.data)
        .slice(0, 25)
        .map((v) => this.positive(this.object(v).group_id))
        .filter((v): v is string => Boolean(v)),
    };
  }
  private async accessToken(c: SproutSocialCredentials) {
    this.requireCredentials(c);
    const key = createHash("sha256")
        .update(`${c.clientId}\0${c.clientSecret}`)
        .digest("hex"),
      cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
    const response = await this.requester(SproutSocialApiAdapter.tokenUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: c.clientId,
          client_secret: c.clientSecret,
          grant_type: "client_credentials",
          scope: "organization_id",
        }).toString(),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      root = await this.response(response);
    const token = this.safeText(root.access_token, 30_000),
      expires = Number(root.expires_in);
    if (!token || !Number.isFinite(expires) || expires < 1)
      throw new SproutSocialApiError(
        "token_refresh_failed",
        "Sprout Social did not return a usable access token.",
      );
    this.tokens.set(key, {
      value: token,
      expiresAt: Date.now() + Math.min(expires, 3_600) * 1_000,
    });
    return token;
  }
  private async get(c: SproutSocialCredentials, path: string) {
    const token = await this.accessToken(c),
      url = new URL(path, SproutSocialApiAdapter.apiOrigin);
    if (url.origin !== SproutSocialApiAdapter.apiOrigin)
      throw new SproutSocialApiError(
        "policy_blocked",
        "Sprout Social request left its fixed API origin.",
      );
    return await this.response(
      await this.requester(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-SproutSocial/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    );
  }
  private async response(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 1_000_000)
      throw new SproutSocialApiError(
        "provider_validation_error",
        "Sprout Social response exceeded 1 MB.",
      );
    let root: Obj;
    try {
      root = this.object(raw.length ? JSON.parse(raw.toString("utf8")) : {});
    } catch {
      throw new SproutSocialApiError(
        "provider_validation_error",
        "Sprout Social returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new SproutSocialApiError(
        this.code(response.status),
        "Sprout Social API request failed.",
        response.status,
      );
    return root;
  }
  private requireCredentials(c: SproutSocialCredentials) {
    if (!c.clientId.trim() || !c.clientSecret.trim())
      throw new SproutSocialApiError(
        "credential_missing",
        "Sprout Social client credentials are missing.",
      );
    if (c.clientId.length > 500 || c.clientSecret.length > 30_000)
      throw new SproutSocialApiError(
        "provider_validation_error",
        "Sprout Social client credentials are invalid.",
      );
  }
  private requiredCustomer(v: string) {
    const id = this.positive(v);
    if (!id)
      throw new SproutSocialApiError(
        "provider_validation_error",
        "Sprout Social customer ID is invalid.",
      );
    return id;
  }
  private positive(v: unknown) {
    const s =
      typeof v === "number" && Number.isSafeInteger(v)
        ? String(v)
        : typeof v === "string"
          ? v
          : "";
    return /^[1-9][0-9]{0,18}$/.test(s) ? s : null;
  }
  private safeText(v: unknown, max: number) {
    return typeof v === "string" ? v.trim().slice(0, max) || null : null;
  }
  private object(v: unknown): Obj {
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
  }
  private array(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
  }
  private code(s: number): MarketplaceConnectorSafeErrorCode {
    if (s === 401) return "token_expired";
    if (s === 403) return "insufficient_scope";
    if (s === 429) return "provider_rate_limited";
    if (s >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
