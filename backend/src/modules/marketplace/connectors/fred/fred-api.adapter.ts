import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type FredCredentials = { apiKey: string };

export class FredApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FredApiAdapter {
  private readonly origin = "https://api.stlouisfed.org";
  private readonly maxResponseBytes = 256 * 1024;
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: FredCredentials) {
    await this.searchSeries(credentials, "gross domestic product");
    return { apiOrigin: this.origin, apiKeyValidated: true };
  }

  async searchSeries(credentials: FredCredentials, rawQuery: unknown) {
    const query = this.searchQuery(rawQuery);
    const body = await this.request("/fred/series/search", credentials, {
      search_text: query,
      file_type: "json",
      limit: "10",
      order_by: "popularity",
      sort_order: "desc",
    });
    const response = this.object(body);
    if (!Array.isArray(response.seriess))
      throw this.invalid("FRED returned invalid series-search data");
    const series = response.seriess as unknown[];
    return {
      query,
      series: series.slice(0, 10).map((value) => {
        const record = this.object(value);
        const id = this.boundedString(record.id, 64);
        const title = this.boundedString(record.title, 240);
        if (!id || !title)
          throw this.invalid("FRED returned invalid series metadata");
        return {
          id,
          title,
          frequency: this.boundedString(record.frequency, 80),
          units: this.boundedString(record.units, 120),
          popularity: this.integer(record.popularity, 0, 100),
        };
      }),
    };
  }

  async getSeriesObservations(
    credentials: FredCredentials,
    rawSeriesId: unknown,
    rawLimit: unknown,
  ) {
    const seriesId = this.seriesId(rawSeriesId);
    const limit = this.limit(rawLimit);
    const body = await this.request("/fred/series/observations", credentials, {
      series_id: seriesId,
      file_type: "json",
      limit: String(limit),
      sort_order: "desc",
    });
    const response = this.object(body);
    if (!Array.isArray(response.observations))
      throw this.invalid("FRED returned invalid observations data");
    const observations = response.observations as unknown[];
    return {
      seriesId,
      observations: observations.slice(0, limit).map((value) => {
        const record = this.object(value);
        const date = this.boundedString(record.date, 10);
        const rawValue = this.boundedString(record.value, 64);
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || rawValue === null)
          throw this.invalid("FRED returned invalid observation data");
        if (
          rawValue !== "." &&
          !/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(rawValue)
        )
          throw this.invalid("FRED returned an invalid observation value");
        return { date, value: rawValue === "." ? null : rawValue };
      }),
    };
  }

  private async request(
    path: "/fred/series/search" | "/fred/series/observations",
    credentials: FredCredentials,
    parameters: Record<string, string>,
  ) {
    const apiKey = credentials.apiKey.trim();
    if (!/^[a-z0-9]{32}$/.test(apiKey))
      throw new FredApiError(
        "credential_missing",
        "A valid customer-owned FRED API key is required",
        401,
      );
    const endpoint = new URL(path, this.origin);
    endpoint.searchParams.set("api_key", apiKey);
    for (const [key, value] of Object.entries(parameters))
      endpoint.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.requester(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "RelayConsole-FRED/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new FredApiError(
        "provider_unavailable",
        "FRED could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new FredApiError(
        this.errorCode(response.status),
        `FRED returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private searchQuery(value: unknown) {
    if (typeof value !== "string") throw this.invalid("query must be a string");
    const normalized = value.trim().replace(/\s+/g, " ");
    if (
      normalized.length < 2 ||
      normalized.length > 80 ||
      /[\u0000-\u001f\u007f]/.test(normalized)
    )
      throw this.invalid("query must contain 2 to 80 printable characters");
    return normalized;
  }
  private seriesId(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(value.trim())
    )
      throw this.invalid("seriesId must be a valid FRED series identifier");
    return value.trim();
  }
  private limit(value: unknown) {
    if (value === undefined || value === null) return 10;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 25
    )
      throw this.invalid("limit must be an integer from 1 to 25");
    return value;
  }
  private boundedString(value: unknown, max: number) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= max
      ? normalized
      : null;
  }
  private integer(value: unknown, min: number, max: number) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isInteger(number) && number >= min && number <= max
      ? number
      : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("FRED response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new FredApiError(
        "provider_unavailable",
        "FRED response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("FRED response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("FRED returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("FRED returned invalid JSON");
      return {};
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 400) return "provider_validation_error";
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new FredApiError("provider_validation_error", message, 400);
  }
}
