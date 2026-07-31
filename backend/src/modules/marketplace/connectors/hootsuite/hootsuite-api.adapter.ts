import type { MarketplaceConnectorSafeErrorCode } from "../types";
type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type HootsuiteCredentials = { accessToken: string };
export class HootsuiteApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export class HootsuiteApiAdapter {
  static readonly origin = "https://platform.hootsuite.com";
  constructor(private readonly requester: Requester = fetch) {}
  async health(c: HootsuiteCredentials) {
    const account = await this.getAccountStatus(c);
    return { apiOrigin: HootsuiteApiAdapter.origin, memberId: account.id };
  }
  async getAccountStatus(c: HootsuiteCredentials) {
    const item = this.record((await this.get(c, "/v1/me")).data);
    return {
      id: this.id(item.id),
      isActive: item.isActive === true,
      createdDate: this.date(item.createdDate),
      modifiedDate: this.date(item.modifiedDate),
      timezone: this.text(item.timezone, 100),
      language: this.text(item.language, 20),
    };
  }
  async listSocialProfileIds(c: HootsuiteCredentials) {
    const root = await this.get(c, "/v1/me/socialProfiles");
    return {
      profiles: (Array.isArray(root.data) ? root.data : [])
        .slice(0, 25)
        .map((v) => ({ id: this.id(this.record(v).id) }))
        .filter((v) => v.id),
    };
  }
  async getSocialProfileStatus(c: HootsuiteCredentials, id: string) {
    const exact = this.id(id);
    if (!exact)
      throw this.validation("Hootsuite social profile ID is invalid.");
    const item = this.record(
      (await this.get(c, `/v1/socialProfiles/${exact}`)).data,
    );
    return {
      id: this.id(item.id),
      type: this.text(item.type, 40),
      owner: this.enumValue(item.owner, ["MEMBER", "ORGANIZATION"]),
      isReauthRequired:
        item.isReauthRequired === true || item.isReauthRequired === 1,
    };
  }
  private async get(c: HootsuiteCredentials, path: string) {
    if (!c.accessToken.trim())
      throw new HootsuiteApiError(
        "credential_missing",
        "Hootsuite OAuth access token is missing.",
      );
    const response = await this.requester(
      new URL(path, HootsuiteApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${c.accessToken}`,
          "User-Agent": "RelayConsole-Hootsuite/1.0",
        },
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation("Hootsuite response exceeded 1 MB.");
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation(
        "Hootsuite returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new HootsuiteApiError(
        this.code(response.status),
        `Hootsuite returned HTTP ${response.status}.`,
        response.status,
      );
    return this.record(body);
  }
  private record(v: unknown): Obj {
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
  }
  private id(v: unknown) {
    const s = String(v ?? "");
    return /^[1-9][0-9]{0,31}$/.test(s) ? s : null;
  }
  private text(v: unknown, max: number) {
    return typeof v === "string" ? v.trim().slice(0, max) || null : null;
  }
  private date(v: unknown) {
    if (typeof v !== "string") return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  private enumValue(v: unknown, values: string[]) {
    return typeof v === "string" && values.includes(v) ? v : null;
  }
  private code(s: number): MarketplaceConnectorSafeErrorCode {
    if (s === 401) return "token_expired";
    if (s === 403) return "insufficient_scope";
    if (s === 429) return "provider_rate_limited";
    if (s >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(m: string, s?: number) {
    return new HootsuiteApiError("provider_validation_error", m, s);
  }
}
