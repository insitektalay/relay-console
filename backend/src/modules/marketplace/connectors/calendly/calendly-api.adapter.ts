import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type CalendlyCredentials = {
  accessToken: string;
  userUri: string;
  organizationUri: string;
};

export class CalendlyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CalendlyApiAdapter {
  private readonly apiOrigin = "https://api.calendly.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: CalendlyCredentials) {
    const body = this.record(
      await this.request(credentials, "/users/me", new URLSearchParams()),
    );
    const resource = this.record(body.resource);
    const userUri = this.resourceUri(resource.uri, "users");
    const organizationUri = this.resourceUri(
      resource.current_organization,
      "organizations",
    );
    if (
      userUri !== credentials.userUri ||
      organizationUri !== credentials.organizationUri
    )
      throw new CalendlyApiError(
        "insufficient_scope",
        "Calendly connected user or organization binding changed.",
        403,
      );
    return {
      userUri,
      organizationUri,
      userName: this.text(resource.name, 200) || null,
      apiOrigin: this.apiOrigin,
    };
  }

  async listEventTypes(
    credentials: CalendlyCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      user: credentials.userUri,
      active: "true",
      count: String(limit),
    });
    const body = this.record(
      await this.request(credentials, "/event_types", query),
    );
    return {
      eventTypes: this.collection(body)
        .slice(0, limit)
        .map((value) => this.eventType(value)),
    };
  }

  async listScheduledEvents(
    credentials: CalendlyCredentials,
    input: { limit?: number } = {},
    now = new Date(),
  ) {
    const limit = this.limit(input.limit);
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({
      user: credentials.userUri,
      min_start_time: now.toISOString(),
      max_start_time: end.toISOString(),
      status: "active",
      count: String(limit),
    });
    const body = this.record(
      await this.request(credentials, "/scheduled_events", query),
    );
    return {
      scheduledEvents: this.collection(body)
        .slice(0, limit)
        .map((value) => this.scheduledEvent(value)),
    };
  }

  async getScheduledEvent(
    credentials: CalendlyCredentials,
    input: { scheduledEventId: string },
  ) {
    const id = this.opaqueId(input.scheduledEventId, "scheduled event");
    const body = this.record(
      await this.request(
        credentials,
        `/scheduled_events/${id}`,
        new URLSearchParams(),
      ),
    );
    return { scheduledEvent: this.scheduledEvent(body.resource) };
  }

  private async request(
    credentials: CalendlyCredentials,
    path: string,
    query: URLSearchParams,
  ) {
    if (!credentials.accessToken.trim())
      throw new CalendlyApiError(
        "credential_missing",
        "Calendly access token is required.",
        401,
      );
    this.resourceUri(credentials.userUri, "users");
    this.resourceUri(credentials.organizationUri, "organizations");
    if (
      !/^\/[A-Za-z0-9_/-]+$/.test(path) ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new CalendlyApiError(
        "provider_validation_error",
        "Calendly API path is invalid.",
      );
    const url = new URL(path, this.apiOrigin);
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
          "User-Agent": "RelayConsole-Calendly/1.0",
        },
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new CalendlyApiError(
        "provider_validation_error",
        "Calendly response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new CalendlyApiError(
        "provider_validation_error",
        "Calendly response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw new CalendlyApiError(
        "provider_validation_error",
        "Calendly returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new CalendlyApiError(
        this.safeCode(response.status),
        `Calendly returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private eventType(value: unknown) {
    const item = this.record(value);
    return {
      eventTypeId: this.uriId(item.uri, "event_types"),
      name: this.text(item.name, 500),
      active: item.active === true,
      durationMinutes: this.number(item.duration),
      kind: this.text(item.kind, 100) || null,
      poolingType: this.text(item.pooling_type, 100) || null,
      slug: this.text(item.slug, 200) || null,
      schedulingUrl: this.publicCalendlyUrl(item.scheduling_url),
      createdAt: this.date(item.created_at),
      updatedAt: this.date(item.updated_at),
    };
  }

  private scheduledEvent(value: unknown) {
    const item = this.record(value);
    const counter = this.record(item.invitees_counter);
    return {
      scheduledEventId: this.uriId(item.uri, "scheduled_events"),
      name: this.text(item.name, 500),
      status: this.text(item.status, 100),
      startTime: this.date(item.start_time),
      endTime: this.date(item.end_time),
      eventTypeId: this.uriId(item.event_type, "event_types"),
      inviteeTotal: this.number(counter.total),
      inviteeActive: this.number(counter.active),
      eventMembershipCount: Math.min(
        Array.isArray(item.event_memberships)
          ? item.event_memberships.length
          : 0,
        10_000,
      ),
      createdAt: this.date(item.created_at),
      updatedAt: this.date(item.updated_at),
    };
  }

  private collection(body: JsonObject) {
    return Array.isArray(body.collection) ? body.collection : [];
  }

  private resourceUri(value: unknown, resource: string) {
    const text = this.text(value, 500);
    if (!text) return "";
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new CalendlyApiError(
        "provider_validation_error",
        `Calendly ${resource} binding is invalid.`,
      );
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "api.calendly.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      parts.length !== 2 ||
      parts[0] !== resource ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(parts[1])
    )
      throw new CalendlyApiError(
        "provider_validation_error",
        `Calendly ${resource} binding is invalid.`,
      );
    return url.toString();
  }

  private uriId(value: unknown, resource: string) {
    const uri = this.resourceUri(value, resource);
    return new URL(uri).pathname.split("/").filter(Boolean)[1];
  }

  private publicCalendlyUrl(value: unknown) {
    const text = this.text(value, 1_000);
    if (!text) return null;
    try {
      const url = new URL(text);
      if (
        url.protocol !== "https:" ||
        !(
          url.hostname === "calendly.com" ||
          url.hostname.endsWith(".calendly.com")
        ) ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
      )
        return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  private opaqueId(value: unknown, label: string) {
    const text = this.text(value, 64);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(text))
      throw new CalendlyApiError(
        "provider_validation_error",
        `Calendly ${label} ID is invalid.`,
      );
    return text;
  }

  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
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
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
