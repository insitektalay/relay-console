import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type HightouchCredentials = { apiKey: string };

export class HightouchApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class HightouchApiAdapter {
  static readonly origin = "https://api.hightouch.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: HightouchCredentials) {
    const summary = await this.getModelReadinessSummary(credentials);
    return {
      apiOrigin: HightouchApiAdapter.origin,
      modelCount: summary.modelCount,
    };
  }

  async getModelReadinessSummary(credentials: HightouchCredentials) {
    this.validate(credentials);
    const root = await this.requester(
      new URL("/api/v1/models", HightouchApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "User-Agent": "RelayConsole-Hightouch/1.0",
        },
      },
    ).catch(() => {
      throw new HightouchApiError(
        "provider_unavailable",
        "Hightouch could not be reached.",
      );
    });
    const raw = Buffer.from(await root.arrayBuffer());
    if (raw.length > 1_000_000)
      throw new HightouchApiError(
        "provider_validation_error",
        "Hightouch response exceeds 1 MB.",
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new HightouchApiError(
        "provider_validation_error",
        "Hightouch returned invalid JSON.",
        root.status,
      );
    }
    if (!root.ok)
      throw new HightouchApiError(
        this.code(root.status),
        `Hightouch returned HTTP ${root.status}.`,
        root.status,
      );
    const object = this.object(value);
    const models = Array.isArray(value)
      ? value
      : Array.isArray(object.data)
        ? object.data
        : Array.isArray(object.models)
          ? object.models
          : null;
    if (!models)
      throw new HightouchApiError(
        "provider_validation_error",
        "Hightouch returned an unexpected model-list shape.",
      );
    return {
      modelCount: models.length,
      redactionStatus:
        "model-identity-definition-query-source-destination-sync-run-and-customer-data-excluded",
    };
  }

  private validate(credentials: HightouchCredentials) {
    if (
      !credentials.apiKey.trim() ||
      credentials.apiKey.length > 30_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new HightouchApiError(
        "credential_missing",
        "A valid Hightouch API key is required.",
        401,
      );
  }

  private object(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Obj)
      : {};
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
