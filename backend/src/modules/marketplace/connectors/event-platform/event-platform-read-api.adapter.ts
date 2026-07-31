import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type EventPlatformCredentials = { apiToken: string };
export type EventPlatformReadConfig = {
  slug: string;
  name: string;
  apiOrigin: string;
  authorization: "bearer" | "token" | "x-api-key" | "basic_api_key";
  listPath: string;
  detailPath: (eventId: string) => string;
  limitParameter?: string;
  listQuery?: Record<string, string>;
  itemContainers?: string[];
};

export class EventPlatformApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

/** Fixed-origin, read-only event metadata boundary shared by event platforms. */
export class EventPlatformReadApiAdapter {
  constructor(
    private readonly config: EventPlatformReadConfig,
    private readonly requester: Requester = fetch,
  ) {}

  async health(credentials: EventPlatformCredentials) {
    await this.listEvents(credentials, { limit: 1 });
    return { apiOrigin: this.config.apiOrigin };
  }

  async listEvents(
    credentials: EventPlatformCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams(this.config.listQuery ?? {});
    query.set(this.config.limitParameter ?? "page_size", String(limit));
    const body = await this.request(credentials, this.config.listPath, query);
    const events = this.items(body)
      .slice(0, limit)
      .map((item) => this.event(item));
    return { events, pageBound: limit, automaticPagination: false };
  }

  async getEvent(
    credentials: EventPlatformCredentials,
    input: { eventId: string },
  ) {
    const eventId = this.identifier(input.eventId, "event ID");
    const body = await this.request(
      credentials,
      this.config.detailPath(eventId),
      new URLSearchParams(),
    );
    const candidate = this.unwrap(body);
    return { event: this.event(candidate) };
  }

  private async request(
    credentials: EventPlatformCredentials,
    path: string,
    query: URLSearchParams,
  ) {
    const token = credentials.apiToken?.trim();
    if (!token)
      throw new EventPlatformApiError(
        "credential_missing",
        `${this.config.name} API token is required.`,
        401,
      );
    if (
      !/^\/[A-Za-z0-9_./{}:-]+\/?$/.test(path) ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new EventPlatformApiError(
        "provider_validation_error",
        `${this.config.name} API path is invalid.`,
      );
    const origin = new URL(this.config.apiOrigin);
    if (origin.protocol !== "https:" || origin.pathname !== "/")
      throw new EventPlatformApiError(
        "provider_validation_error",
        `${this.config.name} API origin is invalid.`,
      );
    const url = new URL(path, origin);
    url.search = query.toString();
    const authorization =
      this.config.authorization === "bearer"
        ? { Authorization: `Bearer ${token}` }
        : this.config.authorization === "token"
          ? { Authorization: `Token ${token}` }
          : this.config.authorization === "basic_api_key"
            ? {
                Authorization: `Basic ${Buffer.from(token).toString("base64")}`,
              }
            : { "X-API-Key": token };
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...authorization,
          "User-Agent": `RelayConsole-${this.config.slug}/1.0`,
        },
      });
    } catch (error) {
      if (error instanceof EventPlatformApiError) throw error;
      throw new EventPlatformApiError(
        "provider_unavailable",
        `${this.config.name} could not be reached.`,
        502,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new EventPlatformApiError(
        "provider_validation_error",
        `${this.config.name} response exceeds Relay's 2 MB boundary.`,
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new EventPlatformApiError(
        "provider_validation_error",
        `${this.config.name} response exceeds Relay's 2 MB boundary.`,
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new EventPlatformApiError(
        "provider_validation_error",
        `${this.config.name} returned invalid JSON.`,
        response.status,
      );
    }
    if (!response.ok)
      throw new EventPlatformApiError(
        this.safeCode(response.status),
        `${this.config.name} returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private items(body: unknown): unknown[] {
    if (Array.isArray(body)) return body;
    let value: unknown = body;
    for (const key of this.config.itemContainers ?? [
      "results",
      "events",
      "data",
      "items",
    ]) {
      const object = this.object(value);
      if (Array.isArray(object[key])) return object[key] as unknown[];
      if (object[key] && typeof object[key] === "object") value = object[key];
    }
    return [];
  }

  private unwrap(body: unknown) {
    const object = this.object(body);
    for (const key of ["event", "data", "result", "item"]) {
      const candidate = object[key];
      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      )
        return candidate;
    }
    return body;
  }

  private event(value: unknown) {
    const item = this.object(value);
    const id = this.first(item, [
      "id",
      "_id",
      "event_id",
      "eventId",
      "uuid",
      "event_uuid",
      "slug",
    ]);
    const name = this.localized(
      this.first(item, ["title", "name", "event_name", "eventName"]),
    );
    if (!id || !name)
      throw new EventPlatformApiError(
        "provider_validation_error",
        `${this.config.name} returned an incomplete event.`,
      );
    return {
      eventId: this.identifier(String(id), "returned event ID"),
      name: name.slice(0, 500),
      status: this.text(
        this.first(item, ["status", "state", "event_status"]),
        100,
      ),
      type: this.text(
        this.first(item, ["type", "event_type", "eventType"]),
        100,
      ),
      startsAt: this.date(
        this.first(item, [
          "start_time",
          "startTime",
          "starts_at",
          "start",
          "start_date",
          "startDate",
          "date_from",
        ]),
      ),
      endsAt: this.date(
        this.first(item, [
          "end_time",
          "endTime",
          "ends_at",
          "end",
          "end_date",
          "endDate",
          "date_to",
        ]),
      ),
      timezone: this.text(
        this.first(item, ["timezone", "time_zone", "tz"]),
        100,
      ),
      publicUrl: this.httpsUrl(
        this.first(item, [
          "url",
          "public_url",
          "event_url",
          "registration_url",
        ]),
      ),
    };
  }

  private first(object: JsonObject, keys: string[]) {
    for (const key of keys)
      if (object[key] !== null && object[key] !== undefined) return object[key];
    return null;
  }
  private localized(value: unknown) {
    if (typeof value === "string" && value.trim()) return value.trim();
    const translations = this.object(value);
    for (const candidate of Object.values(translations))
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim();
    return "";
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(text))
      throw new EventPlatformApiError(
        "provider_validation_error",
        `${this.config.name} ${label} is invalid.`,
      );
    return text;
  }
  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
      : null;
  }
  private date(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private httpsUrl(value: unknown) {
    const text = this.text(value, 2_000);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
