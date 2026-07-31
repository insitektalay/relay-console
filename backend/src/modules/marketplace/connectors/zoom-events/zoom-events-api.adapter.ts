import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { ZOOM_EVENTS_REQUIRED_SCOPE } from "./zoom-events.connector";
type JsonObject = Record<string, unknown>;
export type ZoomEventsCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};
export class ZoomEventsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
@Injectable()
export class ZoomEventsApiAdapter {
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number }
  >();
  async health(c: ZoomEventsCredentials) {
    const result = await this.listLifecycle(c, { limit: 1 });
    return { authorized: true, sampleCount: result.events.length };
  }
  async listLifecycle(c: ZoomEventsCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const token = await this.accessToken(c);
    const url = new URL("https://api.zoom.us/v2/zoom_events/events");
    url.searchParams.set("page_size", String(limit));
    const body = await this.fetchJson(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const events = this.array(body.events)
      .slice(0, limit)
      .map((item) => this.shape(item));
    return {
      events,
      count: events.length,
      nextPageUsed: false,
      completeInventory: false,
    };
  }
  private async accessToken(c: ZoomEventsCredentials) {
    this.require(c.accountId, "Zoom account ID");
    this.require(c.clientId, "Zoom client ID");
    this.require(c.clientSecret, "Zoom client secret");
    const key = createHash("sha256")
      .update(`${c.accountId}\0${c.clientId}\0${c.clientSecret}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000)
      return cached.accessToken;
    const url = new URL("https://zoom.us/oauth/token");
    url.searchParams.set("grant_type", "account_credentials");
    url.searchParams.set("account_id", c.accountId);
    const authorization = Buffer.from(
      `${c.clientId}:${c.clientSecret}`,
      "utf8",
    ).toString("base64");
    const body = await this.fetchJson(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const accessToken = this.text(body.access_token, 30_000);
    const expiresIn = Number(body.expires_in);
    const scopes =
      this.text(body.scope, 10_000)?.split(/\s+/).filter(Boolean) ?? [];
    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn < 1)
      throw new ZoomEventsApiError(
        "token_refresh_failed",
        "Zoom did not return a usable access token.",
      );
    if (!scopes.includes(ZOOM_EVENTS_REQUIRED_SCOPE))
      throw new ZoomEventsApiError(
        "insufficient_scope",
        `Zoom Events requires ${ZOOM_EVENTS_REQUIRED_SCOPE}.`,
        403,
      );
    this.tokens.set(key, {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 3_600) * 1_000,
    });
    return accessToken;
  }
  private shape(value: unknown) {
    const event = this.object(value);
    return {
      eventType: this.enumText(event.event_type, [
        "CONFERENCE",
        "SIMPLE_EVENT",
        "RECURRING",
      ]),
      accessLevel: this.enumText(event.access_level, [
        "PUBLIC",
        "PRIVATE_UNRESTRICTED",
        "PRIVATE_RESTRICTED",
      ]),
      attendanceType: this.enumText(event.attendance_type, [
        "virtual",
        "in-person",
        "hybrid",
      ]),
      meetingType: this.enumText(event.meeting_type, ["MEETING", "WEBINAR"]),
      status: this.enumText(event.status, ["PUBLISHED", "DRAFT"]),
      startTime: this.date(event.start_time),
      endTime: this.date(event.end_time),
      timezone: this.text(event.timezone, 100),
    };
  }
  private async fetchJson(url: URL, init: RequestInit) {
    const allowed =
      (url.origin === "https://zoom.us" && url.pathname === "/oauth/token") ||
      (url.origin === "https://api.zoom.us" &&
        url.pathname === "/v2/zoom_events/events");
    if (!allowed)
      throw new ZoomEventsApiError(
        "policy_blocked",
        "Zoom Events request left its fixed endpoint boundary.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, { ...init, cache: "no-store" });
    } catch (error) {
      throw new ZoomEventsApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Zoom Events request timed out."
          : "Zoom Events could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new ZoomEventsApiError(
        "provider_validation_error",
        "Zoom Events returned more than 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const body = this.object(parsed);
    if (!response.ok)
      throw new ZoomEventsApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    return body;
  }
  private require(value: string, label: string) {
    if (!value)
      throw new ZoomEventsApiError(
        "credential_missing",
        `${label} is required.`,
        401,
      );
  }
  private limit(value: unknown) {
    const n = Number(value ?? 25);
    return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 25) : 25;
  }
  private date(value: unknown) {
    const text = this.text(value, 40);
    return text && Number.isFinite(Date.parse(text))
      ? new Date(text).toISOString()
      : null;
  }
  private enumText(value: unknown, allowed: string[]) {
    const text = this.text(value, 80);
    return text && allowed.includes(text) ? text : null;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
      : null;
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
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private safeMessage(status: number) {
    if (status === 401)
      return "Zoom Events authorization is invalid or expired.";
    if (status === 403)
      return `Zoom Events requires ${ZOOM_EVENTS_REQUIRED_SCOPE} and a Webinars Plus or Events license.`;
    if (status === 429) return "Zoom rate limited the Events request.";
    if (status >= 500) return "Zoom Events is temporarily unavailable.";
    return "Zoom rejected the Events request.";
  }
}
