import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class MeetupApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MeetupApiAdapter {
  private readonly endpoint = "https://api.meetup.com/gql-ext";
  private readonly maxResponseBytes = 512 * 1024;
  private static readonly selfQuery =
    "query RelayMeetupSelf { self { id name } }";
  private static readonly eventQuery =
    "query RelayMeetupEvent($eventId: ID!) { event(id: $eventId) { id title description dateTime eventUrl } }";

  async getSelf(accessToken: string) {
    const data = await this.request(accessToken, MeetupApiAdapter.selfQuery);
    const member = this.object(data.self);
    const memberId = this.identifier(member.id);
    const name = this.boundedString(member.name, 200);
    if (!memberId || !name) {
      throw new MeetupApiError(
        "provider_validation_error",
        "Meetup did not return a useful connected member",
      );
    }
    return { memberId, name };
  }

  async getEvent(accessToken: string, eventIdInput: unknown) {
    const eventId = this.requiredEventId(eventIdInput);
    const data = await this.request(accessToken, MeetupApiAdapter.eventQuery, {
      eventId,
    });
    const event = this.object(data.event);
    const returnedId = this.identifier(event.id);
    const title = this.boundedString(event.title, 500);
    if (returnedId !== eventId) {
      throw new MeetupApiError(
        "provider_validation_error",
        "Meetup returned a different event than requested",
      );
    }
    if (!title) {
      throw new MeetupApiError(
        "provider_validation_error",
        "Meetup event was not found",
      );
    }
    return {
      eventId: returnedId,
      title,
      description: this.boundedString(event.description, 8_000),
      dateTime: this.isoDateTime(event.dateTime),
      eventUrl: this.eventUrl(event.eventUrl, eventId),
    };
  }

  private async request(
    accessToken: string,
    query: string,
    variables?: JsonObject,
  ) {
    let response: Response;
    try {
      response = await safeConnectorFetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole-Meetup/1.0",
        },
        body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new MeetupApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Meetup request timed out"
          : "Meetup request failed",
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok) {
      throw new MeetupApiError(
        this.httpErrorCode(response.status),
        `Meetup request failed with ${response.status}`,
        response.status,
      );
    }
    const root = this.object(body);
    const errors = Array.isArray(root.errors) ? root.errors : [];
    if (errors.length) {
      const rateLimited = errors.some(
        (entry) =>
          this.string(this.object(this.object(entry).extensions).code) ===
          "RATE_LIMITED",
      );
      throw new MeetupApiError(
        rateLimited ? "provider_rate_limited" : "provider_validation_error",
        rateLimited
          ? "Meetup request was rate limited"
          : "Meetup rejected the fixed query",
      );
    }
    const data = this.object(root.data);
    if (!Object.keys(data).length) {
      throw new MeetupApiError(
        "provider_validation_error",
        "Meetup returned no data",
      );
    }
    return data;
  }

  private requiredEventId(value: unknown) {
    const eventId = this.string(value);
    if (!eventId)
      throw new MeetupApiError(
        "provider_validation_error",
        "eventId is required",
      );
    if (eventId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(eventId)) {
      throw new MeetupApiError(
        "provider_validation_error",
        "eventId is invalid",
      );
    }
    return eventId;
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
    return typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : this.string(value);
  }

  private isoDateTime(value: unknown) {
    const text = this.string(value);
    if (!text) return null;
    return !Number.isNaN(Date.parse(text)) && /^\d{4}-\d{2}-\d{2}T/.test(text)
      ? text.slice(0, 64)
      : null;
  }

  private eventUrl(value: unknown, eventId: string) {
    const text = this.string(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      const segments = url.pathname.split("/").filter(Boolean);
      return url.protocol === "https:" &&
        url.hostname === "www.meetup.com" &&
        !url.port &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        segments.length === 3 &&
        segments[1] === "events" &&
        segments[2] === eventId
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes) {
      throw new MeetupApiError(
        "provider_validation_error",
        "Meetup response exceeded the allowed size",
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.maxResponseBytes) {
      throw new MeetupApiError(
        "provider_validation_error",
        "Meetup response exceeded the allowed size",
      );
    }
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) {
        throw new MeetupApiError(
          "provider_validation_error",
          "Meetup returned invalid JSON",
        );
      }
      return {};
    }
  }

  private httpErrorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
