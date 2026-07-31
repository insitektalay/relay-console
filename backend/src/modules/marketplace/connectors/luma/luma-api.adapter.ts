import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type LumaCredentials = {
  apiKey: string;
  boundUserId?: string;
  boundCalendarId?: string;
};

export class LumaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class LumaApiAdapter {
  private readonly apiOrigin = "https://public-api.luma.com";
  private readonly maxResponseBytes = 512 * 1024;

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: LumaCredentials) {
    const user = this.user(
      await this.request(credentials.apiKey, "/v1/users/get-self"),
    );
    const calendar = this.calendar(
      await this.request(credentials.apiKey, "/v1/calendars/get"),
    );
    return {
      userId: user.userId,
      userName: user.name,
      calendarId: calendar.calendarId,
      calendarName: calendar.name,
      calendarUrl: calendar.url,
      apiOrigin: this.apiOrigin,
    };
  }

  async getUser(credentials: LumaCredentials) {
    const user = this.user(
      await this.request(credentials.apiKey, "/v1/users/get-self"),
    );
    this.requireBinding(user.userId, credentials.boundUserId, "user");
    return { name: user.name, verified: true, userBindingVerified: true };
  }

  async getCalendar(credentials: LumaCredentials) {
    const calendar = this.calendar(
      await this.request(credentials.apiKey, "/v1/calendars/get"),
    );
    this.requireBinding(
      calendar.calendarId,
      credentials.boundCalendarId,
      "Calendar",
    );
    return {
      name: calendar.name,
      description: calendar.description,
      url: calendar.url,
      isPersonal: calendar.isPersonal,
      location: calendar.location,
      verified: true,
      calendarBindingVerified: true,
    };
  }

  async listCalendarEvents(
    credentials: LumaCredentials,
    input: { after: unknown; before?: unknown; limit?: unknown },
  ) {
    const after = this.dateTime(input.after, "after");
    const before =
      input.before == null ? null : this.dateTime(input.before, "before");
    if (before) {
      const window = Date.parse(before) - Date.parse(after);
      if (window < 0 || window > 366 * 24 * 60 * 60 * 1000) {
        throw this.invalid(
          "Luma Event windows must be forward-looking and no longer than 366 days",
        );
      }
    }
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      after,
      pagination_limit: String(limit),
      platforms: "luma",
      access: "manage",
      status: "approved",
      sort_column: "start_at",
      sort_direction: "asc",
    });
    if (before) query.set("before", before);
    const body = this.object(
      await this.request(
        credentials.apiKey,
        `/v1/calendars/events/list?${query.toString()}`,
      ),
    );
    if (!Array.isArray(body.entries)) {
      throw this.invalid("Luma returned an invalid Event list");
    }
    const entries = body.entries;
    return {
      events: entries
        .slice(0, limit)
        .map((entry) => this.event(entry, credentials.boundCalendarId)),
      truncated: body.has_more === true,
    };
  }

  async getEvent(credentials: LumaCredentials, eventIdInput: unknown) {
    const eventId = this.eventId(eventIdInput);
    const body = await this.request(
      credentials.apiKey,
      `/v1/events/get?event_id=${encodeURIComponent(eventId)}`,
    );
    return this.event(body, credentials.boundCalendarId, eventId);
  }

  private async request(apiKeyInput: string, path: string) {
    const apiKey = apiKeyInput.trim();
    if (!apiKey || apiKey.length > 16_000 || /[\r\n]/.test(apiKey)) {
      throw new LumaApiError(
        "credential_missing",
        "A valid Luma Calendar API key is required",
        401,
      );
    }
    let response: Response;
    try {
      response = await this.requester(`${this.apiOrigin}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-luma-api-key": apiKey,
          "User-Agent": "RelayConsole-Luma/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new LumaApiError(
        "provider_unavailable",
        "Luma could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok) {
      throw new LumaApiError(
        this.safeCode(response.status),
        `Luma returned HTTP ${response.status}`,
        response.status,
      );
    }
    return body;
  }

  private user(value: unknown) {
    const object = this.object(value);
    const userId = this.identifier(object.id, "user");
    const name = this.text(object.name, 200);
    if (!userId || !name)
      throw this.invalid("Luma returned an incomplete user");
    return { userId, name };
  }

  private calendar(value: unknown) {
    const object = this.object(value);
    const calendarId = this.identifier(object.id, "Calendar");
    const name = this.text(object.name, 300);
    const url = this.lumaUrl(object.url);
    if (!calendarId || !name || !url) {
      throw this.invalid("Luma returned an incomplete Calendar");
    }
    const location = this.object(object.location);
    return {
      calendarId,
      name,
      description: this.text(object.description, 1_000),
      url,
      isPersonal: object.is_personal === true,
      location: Object.keys(location).length
        ? {
            city: this.text(location.city, 200),
            region: this.text(location.region, 200),
            country: this.text(location.country, 200),
            countryCode: this.countryCode(location.country_code),
            timezone: this.timezone(location.timezone),
          }
        : null,
    };
  }

  private event(
    value: unknown,
    boundCalendarId?: string,
    expectedEventId?: string,
  ) {
    const object = this.object(value);
    const eventId = this.eventId(object.id);
    const calendarId = this.identifier(object.calendar_id, "Calendar");
    if (expectedEventId && eventId !== expectedEventId) {
      throw this.invalid("Luma returned a different Event than requested");
    }
    this.requireBinding(calendarId, boundCalendarId, "Calendar");
    if (object.platform !== "luma" || object.access !== "manage") {
      throw this.invalid("Luma Event is not managed by the bound Calendar");
    }
    const name = this.text(object.name, 500);
    const startAt = this.dateTime(object.start_at, "start_at");
    const endAt = this.dateTime(object.end_at, "end_at");
    const url = this.lumaUrl(object.url);
    if (!name || !url) throw this.invalid("Luma returned an incomplete Event");
    const address = this.object(object.geo_address_json);
    return {
      eventId,
      name,
      description: this.text(object.description, 2_000),
      startAt,
      endAt,
      timezone: this.timezone(object.timezone),
      url,
      visibility: this.enumValue(object.visibility, [
        "public",
        "members-only",
        "private",
      ]),
      locationType: this.enumValue(object.location_type, [
        "discord",
        "meet",
        "twitch",
        "twitter",
        "youtube",
        "zoom",
        "offline",
        "missing",
        "unknown",
      ]),
      locationVisibility: this.enumValue(object.location_visibility, [
        "public",
        "guests-only",
      ]),
      location: Object.keys(address).length
        ? {
            city: this.text(address.city, 200),
            region: this.text(address.region, 200),
            country: this.text(address.country, 200),
          }
        : null,
    };
  }

  private requireBinding(
    actual: string,
    expected: string | undefined,
    label: string,
  ) {
    if (!expected) {
      throw new LumaApiError(
        "connection_not_ready",
        `Luma ${label} binding is missing`,
      );
    }
    if (actual !== expected) {
      throw new LumaApiError(
        "provider_validation_error",
        `Luma ${label} binding changed`,
      );
    }
  }

  private identifier(value: unknown, label: string) {
    const text = this.text(value, 128);
    if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) {
      throw this.invalid(`Luma ${label} ID is invalid`);
    }
    return text;
  }

  private eventId(value: unknown) {
    const text = this.text(value, 128);
    if (!text || !/^evt-[A-Za-z0-9_-]+$/.test(text)) {
      throw this.invalid("eventId must be a Luma evt- identifier");
    }
    return text;
  }

  private dateTime(value: unknown, field: string) {
    const text = this.text(value, 64);
    if (
      !text ||
      !/^\d{4}-\d{2}-\d{2}T/.test(text) ||
      Number.isNaN(Date.parse(text)) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(text)
    ) {
      throw this.invalid(`${field} must be an ISO 8601 date-time with offset`);
    }
    return text;
  }

  private lumaUrl(value: unknown) {
    const text = this.text(value, 2_000);
    if (!text) return null;
    try {
      const url = new URL(text);
      const segments = url.pathname.split("/").filter(Boolean);
      return url.protocol === "https:" &&
        ["luma.com", "www.luma.com", "lu.ma"].includes(url.hostname) &&
        segments.length === 1 &&
        !url.port &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  private timezone(value: unknown) {
    const text = this.text(value, 100);
    return text && /^[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(text)
      ? text
      : null;
  }

  private countryCode(value: unknown) {
    const text = this.text(value, 2)?.toUpperCase();
    return text && /^[A-Z]{2}$/.test(text) ? text : null;
  }

  private enumValue(value: unknown, allowed: string[]) {
    const text = this.text(value, 64)?.toLowerCase();
    return text && allowed.includes(text) ? text : null;
  }

  private limit(value: unknown) {
    const number = typeof value === "number" ? value : Number(value ?? 10);
    if (!Number.isFinite(number)) return 10;
    return Math.max(1, Math.min(10, Math.trunc(number)));
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private text(value: unknown, maxLength: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maxLength)
      : null;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes) {
      throw this.invalid("Luma response exceeded the allowed size");
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new LumaApiError(
        "provider_unavailable",
        "Luma response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes) {
      throw this.invalid("Luma response exceeded the allowed size");
    }
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Luma returned invalid JSON");
      return {};
    }
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new LumaApiError("provider_validation_error", message, 400);
  }
}
