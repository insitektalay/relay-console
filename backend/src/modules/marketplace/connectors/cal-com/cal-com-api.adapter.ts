import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type CalComCredentials = {
  accessToken: string;
  userId: string;
  username: string;
};

export class CalComApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CalComApiAdapter {
  private readonly apiOrigin = "https://api.cal.com/v2";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: CalComCredentials) {
    const body = this.record(
      await this.request(credentials, "/me", new URLSearchParams()),
    );
    const user = this.record(body.data);
    const userId = this.positiveId(user.id, "user");
    const username = this.handle(user.username);
    if (userId !== credentials.userId || username !== credentials.username)
      throw new CalComApiError(
        "insufficient_scope",
        "Cal.com connected-user binding changed.",
        403,
      );
    return {
      userId,
      username,
      userName: this.text(user.name, 200) || null,
      apiOrigin: this.apiOrigin,
    };
  }

  async listBookings(
    credentials: CalComCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.request(
        credentials,
        "/bookings",
        new URLSearchParams({ status: "upcoming", limit: String(limit) }),
        "2026-05-01",
      ),
    );
    return {
      bookings: (Array.isArray(body.data) ? body.data : [])
        .slice(0, limit)
        .map((value) => this.booking(value)),
    };
  }

  async getBooking(
    credentials: CalComCredentials,
    input: { bookingUid: string },
  ) {
    const bookingUid = this.opaqueId(input.bookingUid, "Booking UID");
    const body = this.record(
      await this.request(
        credentials,
        `/bookings/${bookingUid}`,
        new URLSearchParams(),
        "2026-02-25",
      ),
    );
    return { booking: this.booking(body.data) };
  }

  async getEventType(
    credentials: CalComCredentials,
    input: { eventTypeId: string },
  ) {
    const eventTypeId = this.positiveId(input.eventTypeId, "Event Type");
    const body = this.record(
      await this.request(
        credentials,
        `/event-types/${eventTypeId}`,
        new URLSearchParams(),
        "2024-06-14",
      ),
    );
    return { eventType: this.eventType(body.data) };
  }

  private async request(
    credentials: CalComCredentials,
    path: string,
    query: URLSearchParams,
    apiVersion?: string,
  ) {
    if (!credentials.accessToken.trim())
      throw new CalComApiError(
        "credential_missing",
        "Cal.com access token is required.",
        401,
      );
    this.positiveId(credentials.userId, "user");
    this.handle(credentials.username);
    if (
      !/^\/[A-Za-z0-9_/-]+$/.test(path) ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new CalComApiError(
        "provider_validation_error",
        "Cal.com API path is invalid.",
      );
    const url = new URL(path, `${this.apiOrigin}/`);
    url.search = query.toString();
    return this.response(
      await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          ...(apiVersion ? { "cal-api-version": apiVersion } : {}),
          "User-Agent": "RelayConsole-CalCom/1.0",
        },
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new CalComApiError(
        "provider_validation_error",
        "Cal.com response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new CalComApiError(
        "provider_validation_error",
        "Cal.com response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw new CalComApiError(
        "provider_validation_error",
        "Cal.com returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new CalComApiError(
        this.safeCode(response.status),
        `Cal.com returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private booking(value: unknown) {
    const item = this.record(value);
    const eventType = this.record(item.eventType);
    return {
      bookingId: this.number(item.id),
      bookingUid: this.text(item.uid, 128),
      title: this.text(item.title, 500),
      status: this.text(item.status, 100),
      start: this.date(item.start),
      end: this.date(item.end),
      durationMinutes: this.number(item.duration),
      eventTypeId: this.number(item.eventTypeId) ?? this.number(eventType.id),
      eventTypeSlug: this.text(eventType.slug, 200) || null,
      absentHost: typeof item.absentHost === "boolean" ? item.absentHost : null,
      createdAt: this.date(item.createdAt),
      updatedAt: this.date(item.updatedAt),
    };
  }

  private eventType(value: unknown) {
    const item = this.record(value);
    return {
      eventTypeId: this.number(item.id),
      title: this.text(item.title, 500),
      slug: this.text(item.slug, 200),
      lengthInMinutes: this.number(item.lengthInMinutes),
      hidden: typeof item.hidden === "boolean" ? item.hidden : null,
      instant:
        typeof item.isInstantEvent === "boolean" ? item.isInstantEvent : null,
      bookingRequiresAuthentication:
        typeof item.bookingRequiresAuthentication === "boolean"
          ? item.bookingRequiresAuthentication
          : null,
      slotIntervalMinutes: this.number(item.slotInterval),
      minimumBookingNoticeMinutes: this.number(item.minimumBookingNotice),
      beforeEventBufferMinutes: this.number(item.beforeEventBuffer),
      afterEventBufferMinutes: this.number(item.afterEventBuffer),
      guestsDisabled:
        typeof item.disableGuests === "boolean" ? item.disableGuests : null,
    };
  }

  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
  }

  private positiveId(value: unknown, label: string) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.text(value, 20);
    if (!/^[1-9][0-9]{0,19}$/.test(text))
      throw new CalComApiError(
        "provider_validation_error",
        `Cal.com ${label} ID is invalid.`,
      );
    return text;
  }

  private handle(value: unknown) {
    const text = this.text(value, 128);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text))
      throw new CalComApiError(
        "provider_validation_error",
        "Cal.com username is invalid.",
      );
    return text;
  }

  private opaqueId(value: unknown, label: string) {
    const text = this.text(value, 128);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text))
      throw new CalComApiError(
        "provider_validation_error",
        `Cal.com ${label} is invalid.`,
      );
    return text;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" ? value.trim().slice(0, maximum) : "";
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private date(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
