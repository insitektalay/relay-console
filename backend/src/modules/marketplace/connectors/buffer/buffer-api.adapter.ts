import type { MarketplaceConnectorSafeErrorCode } from "../types";
type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type BufferCredentials = { accessToken: string };
export class BufferApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export class BufferApiAdapter {
  static readonly origin = "https://api.buffer.com";
  constructor(private readonly requester: Requester = fetch) {}
  async health(c: BufferCredentials) {
    const a = await this.account(c);
    return { apiOrigin: BufferApiAdapter.origin, accountId: a.id };
  }
  async account(c: BufferCredentials) {
    const d = this.record(
      (
        await this.query(
          c,
          "query RelayAccount { account { id createdAt timezone organizations { id channelCount } } }",
        )
      ).account,
    );
    const id = this.id(d.id);
    if (!id) throw this.validation("Buffer account ID was invalid.");
    return {
      id,
      createdAt: this.date(d.createdAt),
      timezone: this.text(d.timezone, 100),
      organizationCount: (Array.isArray(d.organizations)
        ? d.organizations
        : []
      ).slice(0, 25).length,
    };
  }
  async organizations(c: BufferCredentials) {
    const d = this.record(
      (
        await this.query(
          c,
          "query RelayOrganizations { account { organizations { id channelCount } } }",
        )
      ).account,
    );
    return {
      organizations: (Array.isArray(d.organizations) ? d.organizations : [])
        .slice(0, 25)
        .map((v) => {
          const o = this.record(v);
          return {
            id: this.id(o.id),
            channelCount: this.nonnegative(o.channelCount),
          };
        })
        .filter((v) => v.id),
    };
  }
  async channels(c: BufferCredentials, organizationId: string) {
    const id = this.id(organizationId);
    if (!id) throw this.validation("Buffer organization ID is invalid.");
    const d = await this.query(
      c,
      "query RelayChannels($input: ChannelsInput!) { channels(input: $input) { id service type timezone updatedAt } }",
      { input: { organizationId: id } },
    );
    return {
      organizationId: id,
      channels: (Array.isArray(d.channels) ? d.channels : [])
        .slice(0, 25)
        .map((v) => {
          const o = this.record(v);
          return {
            id: this.id(o.id),
            service: this.text(o.service, 40),
            type: this.text(o.type, 40),
            timezone: this.text(o.timezone, 100),
            updatedAt: this.date(o.updatedAt),
          };
        })
        .filter((v) => v.id),
    };
  }
  private async query(
    c: BufferCredentials,
    query: string,
    variables: Obj = {},
  ) {
    if (!c.accessToken.trim())
      throw new BufferApiError(
        "credential_missing",
        "Buffer OAuth access token is missing.",
      );
    const response = await this.requester(BufferApiAdapter.origin, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${c.accessToken}`,
        "User-Agent": "RelayConsole-Buffer/1.0",
      },
      body: JSON.stringify({ query, variables }),
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation("Buffer response exceeded 1 MB.");
    let root: Obj;
    try {
      root = this.record(raw ? JSON.parse(raw) : {});
    } catch {
      throw this.validation("Buffer returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new BufferApiError(
        this.code(response.status),
        `Buffer returned HTTP ${response.status}.`,
        response.status,
      );
    if (Array.isArray(root.errors) && root.errors.length)
      throw this.validation("Buffer GraphQL query failed.", response.status);
    return this.record(root.data);
  }
  private record(v: unknown): Obj {
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
  }
  private id(v: unknown) {
    return typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : null;
  }
  private text(v: unknown, m: number) {
    return typeof v === "string" ? v.trim().slice(0, m) || null : null;
  }
  private date(v: unknown) {
    if (typeof v !== "string") return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  private nonnegative(v: unknown) {
    const n = Number(v);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }
  private code(s: number): MarketplaceConnectorSafeErrorCode {
    if (s === 401) return "token_expired";
    if (s === 403) return "insufficient_scope";
    if (s === 429) return "provider_rate_limited";
    if (s >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(m: string, s?: number) {
    return new BufferApiError("provider_validation_error", m, s);
  }
}
