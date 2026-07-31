import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type DiscoEdiscoveryCredentials = {
  apiKey: string;
  organizationId: string;
};

export type DiscoEdiscoveryUsageSummaryInput = {
  startDate: string;
  endDate: string;
};

export class DiscoEdiscoveryApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class DiscoEdiscoveryApiAdapter {
  static readonly origin = "https://api.csdisco.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: DiscoEdiscoveryCredentials) {
    await this.listDatasets(credentials);
    return {
      apiOrigin: DiscoEdiscoveryApiAdapter.origin,
      exactOrganizationBinding: true,
    };
  }

  async listDatasets(credentials: DiscoEdiscoveryCredentials) {
    const root = this.object(await this.post(credentials, "/datasets", {}));
    const datasets = this.safeStrings(root.datasets).slice(0, 50);
    return {
      datasetCount: datasets.length,
      datasets,
      redactionStatus:
        "organization-id-review-database-matter-session-document-user-and-row-data-excluded",
    };
  }

  async getUsageSummary(
    credentials: DiscoEdiscoveryCredentials,
    input: DiscoEdiscoveryUsageSummaryInput,
  ) {
    const startDate = this.iso(input.startDate, "startDate");
    const endDate = this.iso(input.endDate, "endDate");
    if (Date.parse(startDate) > Date.parse(endDate))
      throw this.validation("startDate must be before or equal to endDate.");
    const [usage, size] = await Promise.all([
      this.post(credentials, "/datasets/data-usage-changes", {
        "start-date": startDate,
        "end-date": endDate,
        "header-row": false,
      }),
      this.post(credentials, "/metrics/metric-reviewdb-size", {
        "end-date": endDate,
      }),
    ]);
    return {
      dataUsageChangeCount: this.safeArray(
        this.object(usage)["data-usage-changes"],
      ).length,
      reviewDatabaseSizeCount: this.safeArray(
        this.object(size)["metric-reviewdb-size"],
      ).length,
      startDate,
      endDate,
      redactionStatus:
        "matter-names-review-database-identifiers-session-identifiers-legal-row-data-and-raw-provider-payloads-excluded",
    };
  }

  private async post(
    credentials: DiscoEdiscoveryCredentials,
    path: string,
    body: Obj,
  ) {
    this.validate(credentials);
    const url = new URL(path, DiscoEdiscoveryApiAdapter.origin);
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole-DISCO-eDiscovery/1.0",
          "disco-api-key": credentials.apiKey,
          "organization-id": credentials.organizationId,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof DiscoEdiscoveryApiError) throw error;
      throw new DiscoEdiscoveryApiError(
        "provider_unavailable",
        "DISCO eDiscovery could not be reached.",
      );
    }
    const raw = await response.text();
    if (
      Number(response.headers.get("content-length") ?? 0) > 1_000_000 ||
      Buffer.byteLength(raw) > 1_000_000
    )
      throw this.validation("DISCO eDiscovery response exceeds 1 MB.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation(
        "DISCO eDiscovery returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new DiscoEdiscoveryApiError(
        this.code(response.status),
        `DISCO eDiscovery returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private validate(credentials: DiscoEdiscoveryCredentials) {
    if (credentials.apiKey.trim().length < 12)
      throw new DiscoEdiscoveryApiError(
        "credential_missing",
        "A DISCO-issued API key is required.",
        401,
      );
    if (!/^[A-Za-z0-9_-]{3,120}$/.test(credentials.organizationId))
      throw new DiscoEdiscoveryApiError(
        "credential_missing",
        "A valid connection-bound DISCO organization ID is required.",
        401,
      );
  }

  private iso(value: string, label: string) {
    if (!value || Number.isNaN(Date.parse(value)))
      throw this.validation(`${label} must be an ISO-8601 datetime.`);
    return value;
  }

  private object(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Obj)
      : {};
  }

  private safeArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value.slice(0, 1000) : [];
  }

  private safeStrings(value: unknown): string[] {
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string")
          .filter((item) => /^[A-Za-z0-9_.-]{1,120}$/.test(item))
      : [];
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string, statusCode?: number) {
    return new DiscoEdiscoveryApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
