import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type CensusCredentials = { apiKey: string };

export class CensusApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CensusApiAdapter {
  static readonly origin = "https://app.getcensus.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: CensusCredentials) {
    const summary = await this.getDatasetReadinessSummary(credentials);
    return {
      apiOrigin: CensusApiAdapter.origin,
      datasetCount: summary.datasetCount,
    };
  }

  async getDatasetReadinessSummary(credentials: CensusCredentials) {
    this.validate(credentials);
    const url = new URL("/api/v1/datasets", CensusApiAdapter.origin);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "1");
    url.searchParams.set("order", "desc");
    const root = await this.requester(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.apiKey}`,
        "User-Agent": "RelayConsole-Census/1.0",
      },
    }).catch(() => {
      throw new CensusApiError(
        "provider_unavailable",
        "Census could not be reached.",
      );
    });
    const raw = Buffer.from(await root.arrayBuffer());
    if (raw.length > 1_000_000)
      throw new CensusApiError(
        "provider_validation_error",
        "Census response exceeds 1 MB.",
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new CensusApiError(
        "provider_validation_error",
        "Census returned invalid JSON.",
        root.status,
      );
    }
    if (!root.ok)
      throw new CensusApiError(
        this.code(root.status),
        `Census returned HTTP ${root.status}.`,
        root.status,
      );
    const object = this.object(value);
    const pagination = this.object(object.pagination);
    const datasetCount = pagination.total_records;
    if (
      object.status !== "success" ||
      !Array.isArray(object.data) ||
      typeof datasetCount !== "number" ||
      !Number.isSafeInteger(datasetCount) ||
      datasetCount < 0
    )
      throw new CensusApiError(
        "provider_validation_error",
        "Census returned an unexpected dataset-list shape.",
      );
    return {
      datasetCount,
      redactionStatus:
        "dataset-identity-query-source-sync-destination-run-and-customer-data-excluded",
    };
  }

  private validate(credentials: CensusCredentials) {
    if (
      !credentials.apiKey.trim() ||
      credentials.apiKey.length > 30_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new CensusApiError(
        "credential_missing",
        "A valid Census workspace API key is required.",
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
