import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class EventbriteApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class EventbriteApiAdapter {
  private readonly baseUrl = "https://www.eventbriteapi.com/v3";
  private readonly maxResponseBytes = 512 * 1024;

  async getUser(accessToken: string) {
    return this.shapeUser(await this.request(accessToken, "/users/me/"));
  }

  async listOrganizations(accessToken: string, limitInput: unknown = 10) {
    const limit = this.limit(limitInput);
    const body = this.object(
      await this.request(accessToken, "/users/me/organizations/"),
    );
    const organizations = Array.isArray(body.organizations)
      ? body.organizations
      : [];
    return organizations
      .slice(0, limit)
      .map((value) => this.shapeOrganization(value));
  }

  async listOrganizationEvents(
    accessToken: string,
    organizationIdInput: unknown,
    limitInput: unknown = 10,
  ) {
    const organizationId = this.numericId(
      organizationIdInput,
      "organizationId",
    );
    const limit = this.limit(limitInput);
    const membershipBody = this.object(
      await this.request(accessToken, "/users/me/organizations/"),
    );
    const memberships = Array.isArray(membershipBody.organizations)
      ? membershipBody.organizations
      : [];
    const member = memberships.some(
      (value) => this.identifier(this.object(value).id) === organizationId,
    );
    if (!member) {
      throw new EventbriteApiError(
        "provider_validation_error",
        "Eventbrite Organization is not in the connected user's returned memberships",
      );
    }
    const body = this.object(
      await this.request(
        accessToken,
        `/organizations/${encodeURIComponent(organizationId)}/events/`,
      ),
    );
    const events = Array.isArray(body.events) ? body.events : [];
    return events.slice(0, limit).map((value) => this.shapeEvent(value));
  }

  async getEvent(accessToken: string, eventIdInput: unknown) {
    const eventId = this.numericId(eventIdInput, "eventId");
    return this.shapeEvent(
      await this.request(
        accessToken,
        `/events/${encodeURIComponent(eventId)}/?expand=venue`,
      ),
      eventId,
    );
  }

  private async request(accessToken: string, path: string) {
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Eventbrite/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new EventbriteApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Eventbrite request timed out"
          : "Eventbrite request failed",
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok) {
      throw new EventbriteApiError(
        this.errorCode(response.status),
        `Eventbrite request failed with ${response.status}`,
        response.status,
      );
    }
    return body;
  }

  private shapeUser(value: unknown) {
    const object = this.object(value);
    const userId = this.identifier(object.id);
    const name = this.boundedString(object.name, 200);
    if (!userId || !name)
      throw new EventbriteApiError(
        "provider_validation_error",
        "Eventbrite user is incomplete",
      );
    return { userId, name };
  }

  private shapeOrganization(value: unknown) {
    const object = this.object(value);
    const organizationId = this.identifier(object.id);
    const name = this.boundedString(object.name, 200);
    if (!organizationId || !name) {
      throw new EventbriteApiError(
        "provider_validation_error",
        "Eventbrite Organization is incomplete",
      );
    }
    return { organizationId, name };
  }

  private shapeEvent(value: unknown, expectedEventId?: string) {
    const event = this.object(value);
    const eventId = this.identifier(event.id);
    const name = this.boundedString(this.multipartText(event.name), 500);
    if (expectedEventId && eventId !== expectedEventId) {
      throw new EventbriteApiError(
        "provider_validation_error",
        "Eventbrite returned a different Event than requested",
      );
    }
    const url = eventId ? this.eventUrl(event.url, eventId) : null;
    const start = this.shapeDateTime(event.start);
    const end = this.shapeDateTime(event.end);
    if (!eventId || !name || !url || !start.utc || !end.utc) {
      throw new EventbriteApiError(
        "provider_validation_error",
        "Eventbrite Event is incomplete",
      );
    }
    const venue = this.object(event.venue);
    const address = this.object(venue.address);
    return {
      eventId,
      name,
      summary: this.boundedString(event.summary, 500),
      url,
      start,
      end,
      status: this.eventStatus(event.status),
      onlineEvent: event.online_event === true,
      currency: this.currency(event.currency),
      capacity:
        typeof event.capacity === "number" &&
        Number.isSafeInteger(event.capacity) &&
        event.capacity >= 0 &&
        event.capacity <= 1_000_000_000
          ? event.capacity
          : null,
      venue: Object.keys(venue).length
        ? {
            name: this.boundedString(venue.name, 300),
            address: this.boundedString(address.address_1, 300),
            city: this.boundedString(address.city, 200),
            region: this.boundedString(address.region, 100),
            postalCode: this.boundedString(address.postal_code, 32),
            country: this.country(address.country),
          }
        : null,
    };
  }

  private shapeDateTime(value: unknown) {
    const object = this.object(value);
    return {
      utc: this.utcDateTime(object.utc),
      local: this.localDateTime(object.local),
      timezone: this.timezone(object.timezone),
    };
  }

  private multipartText(value: unknown) {
    return this.string(this.object(value).text) ?? this.string(value);
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private boundedString(value: unknown, maxLength: number) {
    const text = this.string(value);
    return text ? text.slice(0, maxLength) : null;
  }
  private identifier(value: unknown) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.string(value);
    return text && /^[0-9]+$/.test(text) && text.length <= 64 ? text : null;
  }
  private numericId(value: unknown, field: string) {
    const id = this.identifier(value);
    if (!id)
      throw new EventbriteApiError(
        "provider_validation_error",
        `${field} must be a numeric Eventbrite ID`,
      );
    return id;
  }
  private limit(value: unknown) {
    const number = typeof value === "number" ? value : Number(value ?? 10);
    if (!Number.isFinite(number)) return 10;
    return Math.max(1, Math.min(10, Math.trunc(number)));
  }
  private eventUrl(value: unknown, eventId: string) {
    const text = this.string(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      const segments = url.pathname.split("/").filter(Boolean);
      const listing =
        segments.length === 2 && segments[0] === "e" ? segments[1] : "";
      return url.protocol === "https:" &&
        url.hostname === "www.eventbrite.com" &&
        !url.port &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        (listing === eventId || listing.endsWith(`-${eventId}`))
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
  private utcDateTime(value: unknown) {
    const text = this.string(value);
    return text &&
      text.length <= 64 &&
      /^\d{4}-\d{2}-\d{2}T/.test(text) &&
      !Number.isNaN(Date.parse(text)) &&
      /Z$/.test(text)
      ? text
      : null;
  }
  private localDateTime(value: unknown) {
    const text = this.string(value);
    return text &&
      text.length <= 64 &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text)
      ? text
      : null;
  }
  private timezone(value: unknown) {
    const text = this.string(value);
    return text &&
      text.length <= 100 &&
      /^[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(text)
      ? text
      : null;
  }
  private eventStatus(value: unknown) {
    const status = this.string(value)?.toLowerCase();
    return status &&
      ["draft", "live", "started", "ended", "canceled"].includes(status)
      ? status
      : null;
  }
  private currency(value: unknown) {
    const currency = this.string(value)?.toUpperCase();
    return currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
  }
  private country(value: unknown) {
    const country = this.string(value)?.toUpperCase();
    return country && /^[A-Z]{2}$/.test(country) ? country : null;
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes) {
      throw new EventbriteApiError(
        "provider_validation_error",
        "Eventbrite response exceeded the allowed size",
      );
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new EventbriteApiError(
        "provider_unavailable",
        "Eventbrite response could not be read",
      );
    }
    if (bytes.byteLength > this.maxResponseBytes) {
      throw new EventbriteApiError(
        "provider_validation_error",
        "Eventbrite response exceeded the allowed size",
      );
    }
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) {
        throw new EventbriteApiError(
          "provider_validation_error",
          "Eventbrite returned invalid JSON",
        );
      }
      return {};
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
