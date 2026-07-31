import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class LivestormApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class LivestormApiAdapter {
  async health(accessToken: string) {
    await this.identity(accessToken);
    return { authorized: true };
  }

  async listEventLifecycle(accessToken: string, input: JsonObject) {
    if (!accessToken) {
      throw new LivestormApiError(
        "credential_missing",
        "Livestorm OAuth access is required.",
        401,
      );
    }
    await this.identity(accessToken);
    const limit = this.limit(input.limit);
    const url = new URL("https://api.livestorm.co/v1/events");
    url.searchParams.set("page[number]", "1");
    url.searchParams.set("page[size]", String(limit));
    const body = await this.fetchJson(url, accessToken, "event_list");
    const events = this.array(body.data)
      .slice(0, limit)
      .map((value) => this.shape(value));
    return {
      events,
      count: events.length,
      nextPageUsed: false,
      completeInventory: false,
    };
  }

  private async identity(accessToken: string) {
    const body = await this.fetchJson(
      new URL("https://api.livestorm.co/v1/me"),
      accessToken,
      "identity",
    );
    const data = this.object(body.data);
    if (data.type !== "users" || !this.uuid(data.id)) {
      throw new LivestormApiError(
        "provider_validation_error",
        "Livestorm did not return a usable connected-user identity.",
      );
    }
  }

  private shape(value: unknown) {
    const resource = this.object(value);
    const attributes = this.object(resource.attributes);
    return {
      schedulingStatus: this.enumText(attributes.scheduling_status, [
        "live",
        "upcoming",
        "on_demand",
        "ended",
        "not_started",
        "draft",
        "cancelled",
        "not_scheduled",
      ]),
      publicationStatus: this.enumText(attributes.status, [
        "draft",
        "published",
      ]),
      estimatedDurationMinutes: this.boundedNumber(
        attributes.estimated_duration,
        0,
        1_440,
      ),
      sessionsCount: this.boundedNumber(attributes.sessions_count, 0, 10_000),
      everyoneCanSpeak: attributes.everyone_can_speak === true,
      registrationPageEnabled: attributes.registration_page_enabled === true,
      recordingEnabled: attributes.recording_enabled === true,
      createdAt: this.epochDate(attributes.created_at),
      updatedAt: this.epochDate(attributes.updated_at),
    };
  }

  private async fetchJson(
    url: URL,
    accessToken: string,
    route: "identity" | "event_list",
  ) {
    const allowed =
      url.origin === "https://api.livestorm.co" &&
      (route === "identity"
        ? url.pathname === "/v1/me" && !url.search
        : url.pathname === "/v1/events" &&
          url.searchParams.get("page[number]") === "1" &&
          /^(?:[1-9]|1[0-9]|2[0-5])$/.test(
            url.searchParams.get("page[size]") ?? "",
          ) &&
          [...url.searchParams.keys()].every((key) =>
            ["page[number]", "page[size]"].includes(key),
          ));
    if (!allowed) {
      throw new LivestormApiError(
        "policy_blocked",
        "Livestorm request left its fixed endpoint boundary.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new LivestormApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Livestorm request timed out."
          : "Livestorm could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000) {
      throw new LivestormApiError(
        "provider_validation_error",
        "Livestorm returned more than 1 MB.",
      );
    }
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      throw new LivestormApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    }
    return this.object(parsed);
  }

  private uuid(value: unknown) {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value
      : null;
  }

  private epochDate(value: unknown) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0 && seconds <= 32_503_680_000
      ? new Date(Math.floor(seconds) * 1_000).toISOString()
      : null;
  }

  private enumText(value: unknown, allowed: string[]) {
    return typeof value === "string" && allowed.includes(value) ? value : null;
  }

  private boundedNumber(value: unknown, minimum: number, maximum: number) {
    const number = Number(value);
    return Number.isFinite(number) && number >= minimum && number <= maximum
      ? Math.floor(number)
      : null;
  }

  private limit(value: unknown) {
    const number = Number(value ?? 25);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), 1), 25)
      : 25;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private safeMessage(status: number) {
    if (status === 401) return "Livestorm authorization is invalid or expired.";
    if (status === 403)
      return "Livestorm requires identity:read, events:read, a validated workspace, and an eligible Technology Partner grant.";
    if (status === 429) return "Livestorm rate limited the event request.";
    if (status >= 500) return "Livestorm is temporarily unavailable.";
    return "Livestorm rejected the event request.";
  }
}
