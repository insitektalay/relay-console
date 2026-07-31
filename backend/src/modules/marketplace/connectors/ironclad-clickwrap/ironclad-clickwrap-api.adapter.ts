import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type IroncladClickwrapCredentials = {
  accessToken: string;
  siteId: string;
};

export class IroncladClickwrapApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class IroncladClickwrapApiAdapter {
  private readonly apiOrigin = "https://api.pactsafe.com/v1.1";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: IroncladClickwrapCredentials) {
    const body = this.record(
      await this.request(
        credentials,
        `/sites/${this.siteId(credentials.siteId)}`,
      ),
    );
    const site = this.site(body.data);
    if (site.siteId !== credentials.siteId)
      throw new IroncladClickwrapApiError(
        "provider_validation_error",
        "Ironclad Clickwrap returned a different Site than the configured binding.",
        409,
      );
    return {
      siteId: site.siteId,
      siteName: site.name,
      apiOrigin: this.apiOrigin,
    };
  }

  async getSite(credentials: IroncladClickwrapCredentials) {
    const body = this.record(
      await this.request(
        credentials,
        `/sites/${this.siteId(credentials.siteId)}`,
      ),
    );
    return { site: this.site(body.data) };
  }

  async listContracts(
    credentials: IroncladClickwrapCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.request(
        credentials,
        `/sites/${this.siteId(credentials.siteId)}/contract`,
        new URLSearchParams({
          page: "1",
          per_page: String(limit),
          includeArchived: "false",
        }),
      ),
    );
    return {
      contracts: this.array(body.data)
        .slice(0, limit)
        .map((value) => this.contract(value)),
    };
  }

  async listGroups(
    credentials: IroncladClickwrapCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.request(
        credentials,
        `/sites/${this.siteId(credentials.siteId)}/groups`,
        new URLSearchParams({ page: "1", per_page: String(limit) }),
      ),
    );
    return {
      groups: this.array(body.data)
        .slice(0, limit)
        .map((value) => this.group(value)),
    };
  }

  private async request(
    credentials: IroncladClickwrapCredentials,
    path: string,
    query = new URLSearchParams(),
  ) {
    const accessToken = credentials.accessToken.trim();
    this.siteId(credentials.siteId);
    if (
      !accessToken ||
      accessToken.length > 32_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new IroncladClickwrapApiError(
        "credential_missing",
        "A valid Ironclad Clickwrap access token is required.",
        401,
      );
    if (!/^\/sites\/[1-9][0-9]{0,19}(?:\/(?:contract|groups))?$/.test(path))
      throw new IroncladClickwrapApiError(
        "policy_blocked",
        "Only the exact configured Clickwrap Site and its bounded Contract or Group collection may be read.",
        403,
      );
    const url = new URL(path.slice(1), `${this.apiOrigin}/`);
    url.search = query.toString();
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-IroncladClickwrap/1.0",
        },
      });
    } catch (error) {
      if (error instanceof IroncladClickwrapApiError) throw error;
      throw new IroncladClickwrapApiError(
        "provider_unavailable",
        "Ironclad Clickwrap could not be reached.",
        502,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw this.invalid(
        "Ironclad Clickwrap response exceeds Relay's 2 MB boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw this.invalid(
        "Ironclad Clickwrap response exceeds Relay's 2 MB boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.invalid("Ironclad Clickwrap returned invalid JSON.");
    }
    if (!response.ok)
      throw new IroncladClickwrapApiError(
        this.safeCode(response.status),
        `Ironclad Clickwrap returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private site(value: unknown) {
    const item = this.record(value);
    return {
      siteId: this.siteId(item.id),
      name: this.text(item.name, 300) || null,
      key: this.safeKey(item.key),
      active: this.boolean(item.active),
      createdAt: this.date(item.created_at ?? item.createdAt),
      updatedAt: this.date(item.updated_at ?? item.updatedAt),
    };
  }

  private contract(value: unknown) {
    const item = this.record(value);
    return {
      contractId: this.optionalId(item.id),
      name: this.text(item.name ?? item.title, 500) || null,
      status: this.text(item.status, 100) || null,
      archived: this.boolean(item.archived),
      createdAt: this.date(item.created_at ?? item.createdAt),
      updatedAt: this.date(item.updated_at ?? item.updatedAt),
    };
  }

  private group(value: unknown) {
    const item = this.record(value);
    return {
      groupId: this.optionalId(item.id),
      name: this.text(item.name ?? item.title, 500) || null,
      key: this.safeKey(item.key),
      status: this.text(item.status, 100) || null,
      createdAt: this.date(item.created_at ?? item.createdAt),
      updatedAt: this.date(item.updated_at ?? item.updatedAt),
    };
  }

  private siteId(value: unknown) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.text(value, 20);
    if (!/^[1-9][0-9]{0,19}$/.test(text))
      throw this.invalid(
        "Ironclad Clickwrap Site ID must be a positive integer.",
      );
    return text;
  }

  private optionalId(value: unknown) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.text(value, 64);
    return /^[A-Za-z0-9_-]{1,64}$/.test(text) ? text : null;
  }

  private safeKey(value: unknown) {
    const text = this.text(value, 128);
    return /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : null;
  }

  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" ? value.trim().slice(0, maximum) : "";
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }

  private date(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }

  private invalid(message: string) {
    return new IroncladClickwrapApiError("provider_validation_error", message);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
