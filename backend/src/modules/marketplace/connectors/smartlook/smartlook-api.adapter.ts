import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type SmartlookCredentials = { apiToken: string; region: string };

export class SmartlookApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SmartlookApiAdapter {
  private static readonly EVENTS_PATH = "/api/v1/events";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: SmartlookCredentials) {
    await this.fetchEvents(credentials, 1);
    return {
      apiTokenVerified: true,
      exactProjectToken: true,
      region: this.region(credentials.region),
      eventDataReturned: false,
      visitorDataReturned: false,
      sessionDataReturned: false,
      writesEnabled: false,
    };
  }

  async listEventDefinitions(
    credentials: SmartlookCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const value = this.object(await this.fetchEvents(credentials, limit));
    const source = Array.isArray(value.events)
      ? value.events
      : Array.isArray(value.data)
        ? value.data
        : [];
    const definitions = source.slice(0, limit).map((entry) => {
      const event = this.object(entry);
      return {
        eventId: this.scalar(event.id ?? event.oid ?? event._id, 128),
        name: this.scalar(event.name, 256),
        type: this.scalar(event.type ?? event.eventType, 64),
        categoryId: this.scalar(event.categoryId ?? event.category_id, 128),
      };
    });
    return {
      semanticReadContract: "smartlook-event-definition-list-v1",
      definitions,
      returnedCount: definitions.length,
      maxResults: limit,
      region: this.region(credentials.region),
      providerRequestCount: 1,
      visitorDataReturned: false,
      sessionDataReturned: false,
      recordingsReturned: false,
      eventOccurrencesReturned: false,
      eventPropertiesReturned: false,
      urlsReturned: false,
      cursorsReturned: false,
      linksReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchEvents(credentials: SmartlookCredentials, limit: number) {
    const token = this.token(credentials.apiToken);
    const region = this.region(credentials.region);
    const origin = `https://api.${region}.smartlook.cloud`;
    const url = new URL(SmartlookApiAdapter.EVENTS_PATH, `${origin}/`);
    url.searchParams.set("limit", String(limit));
    if (
      url.origin !== origin ||
      url.pathname !== SmartlookApiAdapter.EVENTS_PATH ||
      [...url.searchParams.keys()].some((key) => key !== "limit") ||
      url.hash
    )
      throw new SmartlookApiError(
        "policy_blocked",
        "Smartlook request escaped Relay's fixed event-definition allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new SmartlookApiError(
        "provider_unavailable",
        "Smartlook REST API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Smartlook response exceeded Relay's 1 MB bound.");
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Smartlook returned invalid JSON.");
    }
    if (!response.ok)
      throw new SmartlookApiError(
        this.errorCode(response.status),
        "Smartlook rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private token(value: string) {
    const token = value?.trim();
    if (!token || token.length > 20_000)
      throw new SmartlookApiError(
        "credential_missing",
        "Smartlook project API token is missing.",
        401,
      );
    return token;
  }

  private region(value: string) {
    const region = value?.trim().toLowerCase();
    if (region !== "eu" && region !== "us")
      throw this.validation("Smartlook region must be eu or us.");
    return region;
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw this.validation("limit must be an integer from 1 to 25.");
    return Number(value);
  }

  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new SmartlookApiError("provider_validation_error", message);
  }
}
