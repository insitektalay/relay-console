import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type MyCaseCredentials = { accessToken: string };

export class MyCaseApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class MyCaseApiAdapter {
  static readonly origin = "https://external-integrations.mycase.com";
  static readonly apiVersion = "v1";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: MyCaseCredentials) {
    await this.getConnectionAuthority(credentials);
    return { apiOrigin: MyCaseApiAdapter.origin, apiVersion: MyCaseApiAdapter.apiVersion };
  }

  async getConnectionAuthority(credentials: MyCaseCredentials) {
    const token = credentials.accessToken.trim();
    if (!token || token.length > 30_000 || /[\r\n]/.test(token))
      throw new MyCaseApiError("credential_missing", "A valid MyCase Open API access token is required.", 401);
    const response = await this.requester(
      new URL("/v1/firm", MyCaseApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-MyCase/1.0",
        },
      },
    ).catch(() => {
      throw new MyCaseApiError("provider_unavailable", "MyCase could not be reached.");
    });
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 1_000_000)
      throw new MyCaseApiError("provider_validation_error", "MyCase response exceeded 1 MB.");
    let body: unknown;
    try {
      body = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new MyCaseApiError("provider_validation_error", "MyCase returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new MyCaseApiError(this.code(response.status), `MyCase returned HTTP ${response.status}.`, response.status);
    const root = this.record(body);
    const candidate = this.record(root.data);
    const firm = Object.keys(candidate).length ? candidate : Object.keys(this.record(root.firm)).length ? this.record(root.firm) : root;
    if (!this.validId(firm.id))
      throw new MyCaseApiError("provider_validation_error", "MyCase returned no valid authorized-firm authority.");
    return {
      authorized: true,
      apiVersion: MyCaseApiAdapter.apiVersion,
      redactionStatus: "firm-user-and-legal-practice-data-excluded",
    };
  }

  private record(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
  }

  private validId(value: unknown) {
    return typeof value === "number"
      ? Number.isSafeInteger(value) && value > 0
      : /^(?:[1-9][0-9]{0,18}|[0-9a-f]{8}-[0-9a-f-]{27,})$/i.test(String(value ?? ""));
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
