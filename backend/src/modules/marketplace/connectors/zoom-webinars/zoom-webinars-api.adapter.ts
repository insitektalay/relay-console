import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { ZOOM_WEBINARS_REQUIRED_SCOPE } from "./zoom-webinars.connector";
type JsonObject = Record<string, unknown>;
export type ZoomWebinarsCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
  hostId: string;
};
export class ZoomWebinarsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
@Injectable()
export class ZoomWebinarsApiAdapter {
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number }
  >();
  async health(c: ZoomWebinarsCredentials) {
    const result = await this.listLifecycle(c, { limit: 1 });
    return { authorized: true, sampleCount: result.webinars.length };
  }
  async listLifecycle(c: ZoomWebinarsCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const hostId = this.hostId(c.hostId);
    const token = await this.accessToken(c);
    const url = new URL(
      `https://api.zoom.us/v2/users/${encodeURIComponent(hostId)}/webinars`,
    );
    url.searchParams.set("page_size", String(limit));
    url.searchParams.set("include_events_webinar", "false");
    const body = await this.fetchJson(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const webinars = this.array(body.webinars)
      .slice(0, limit)
      .map((item) => this.shape(item));
    return {
      webinars,
      count: webinars.length,
      nextPageUsed: false,
      completeSchedule: false,
    };
  }
  private async accessToken(c: ZoomWebinarsCredentials) {
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
      throw new ZoomWebinarsApiError(
        "token_refresh_failed",
        "Zoom did not return a usable access token.",
      );
    if (!scopes.includes(ZOOM_WEBINARS_REQUIRED_SCOPE))
      throw new ZoomWebinarsApiError(
        "insufficient_scope",
        `Zoom Webinars requires ${ZOOM_WEBINARS_REQUIRED_SCOPE}.`,
        403,
      );
    this.tokens.set(key, {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 3_600) * 1_000,
    });
    return accessToken;
  }
  private shape(value: unknown) {
    const webinar = this.object(value);
    return {
      startTime: this.date(webinar.start_time),
      timezone: this.text(webinar.timezone, 100),
      durationMinutes: this.integer(webinar.duration, 1, 1440),
      type: this.integer(webinar.type, 5, 9),
      simulive:
        typeof webinar.is_simulive === "boolean" ? webinar.is_simulive : null,
      eventsWebinar:
        typeof webinar.is_events_webinar === "boolean"
          ? webinar.is_events_webinar
          : null,
    };
  }
  private async fetchJson(url: URL, init: RequestInit) {
    const webinarPath = /^\/v2\/users\/[A-Za-z0-9_-]{1,128}\/webinars$/.test(
      url.pathname,
    );
    const allowed =
      (url.origin === "https://zoom.us" && url.pathname === "/oauth/token") ||
      (url.origin === "https://api.zoom.us" && webinarPath);
    if (!allowed)
      throw new ZoomWebinarsApiError(
        "policy_blocked",
        "Zoom Webinars request left its fixed endpoint boundary.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, { ...init, cache: "no-store" });
    } catch (error) {
      throw new ZoomWebinarsApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Zoom Webinars request timed out."
          : "Zoom Webinars could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new ZoomWebinarsApiError(
        "provider_validation_error",
        "Zoom Webinars returned more than 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const body = this.object(parsed);
    if (!response.ok)
      throw new ZoomWebinarsApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    return body;
  }
  private hostId(value: string) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(value))
      throw new ZoomWebinarsApiError(
        "credential_missing",
        "A valid fixed Zoom webinar host ID is required.",
        401,
      );
    return value;
  }
  private require(value: string, label: string) {
    if (!value)
      throw new ZoomWebinarsApiError(
        "credential_missing",
        `${label} is required.`,
        401,
      );
  }
  private limit(value: unknown) {
    const n = Number(value ?? 25);
    return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 25) : 25;
  }
  private integer(value: unknown, minimum: number, maximum: number) {
    const n = Number(value);
    return Number.isInteger(n) && n >= minimum && n <= maximum ? n : null;
  }
  private date(value: unknown) {
    const text = this.text(value, 40);
    return text && Number.isFinite(Date.parse(text))
      ? new Date(text).toISOString()
      : null;
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
      return "Zoom Webinars authorization is invalid or expired.";
    if (status === 403)
      return `Zoom Webinars requires ${ZOOM_WEBINARS_REQUIRED_SCOPE}, the configured host, and a webinar plan.`;
    if (status === 429) return "Zoom rate limited the webinar request.";
    if (status >= 500) return "Zoom Webinars is temporarily unavailable.";
    return "Zoom rejected the webinar request.";
  }
}
