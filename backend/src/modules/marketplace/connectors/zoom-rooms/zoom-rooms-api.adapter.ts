import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { ZOOM_ROOMS_REQUIRED_SCOPE } from "./zoom-rooms.connector";

type JsonObject = Record<string, unknown>;
export type ZoomRoomsCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};
export class ZoomRoomsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ZoomRoomsApiAdapter {
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number }
  >();
  async health(credentials: ZoomRoomsCredentials) {
    const result = await this.listFleetHealth(credentials, { limit: 1 });
    return { authorized: true, sampleCount: result.rooms.length };
  }
  async listFleetHealth(credentials: ZoomRoomsCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const token = await this.accessToken(credentials);
    const url = new URL("https://api.zoom.us/v2/rooms");
    url.searchParams.set("page_size", String(limit));
    const body = await this.fetchJson(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const rooms = this.array(body.rooms)
      .slice(0, limit)
      .map((item) => this.shape(item));
    return {
      rooms,
      count: rooms.length,
      nextPageUsed: false,
      completeFleet: false,
    };
  }
  private async accessToken(credentials: ZoomRoomsCredentials) {
    this.require(credentials.accountId, "Zoom account ID");
    this.require(credentials.clientId, "Zoom client ID");
    this.require(credentials.clientSecret, "Zoom client secret");
    const key = createHash("sha256")
      .update(
        `${credentials.accountId}\0${credentials.clientId}\0${credentials.clientSecret}`,
      )
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000)
      return cached.accessToken;
    const url = new URL("https://zoom.us/oauth/token");
    url.searchParams.set("grant_type", "account_credentials");
    url.searchParams.set("account_id", credentials.accountId);
    const authorization = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
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
      throw new ZoomRoomsApiError(
        "token_refresh_failed",
        "Zoom did not return a usable access token.",
      );
    if (!scopes.includes(ZOOM_ROOMS_REQUIRED_SCOPE))
      throw new ZoomRoomsApiError(
        "insufficient_scope",
        `Zoom Rooms requires ${ZOOM_ROOMS_REQUIRED_SCOPE}.`,
        403,
      );
    this.tokens.set(key, {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 3_600) * 1_000,
    });
    return accessToken;
  }
  private shape(value: unknown) {
    const room = this.object(value);
    return {
      status: this.enumText(room.status, [
        "Offline",
        "Available",
        "InMeeting",
        "UnderConstruction",
      ]),
      type: this.enumText(room.type, [
        "ZoomRoom",
        "CiscoRoom",
        "PersonalZoomRoom",
      ]),
      proDevice: typeof room.pro_device === "boolean" ? room.pro_device : null,
      tagCount: Math.min(this.array(room.tag_ids).length, 100),
    };
  }
  private async fetchJson(url: URL, init: RequestInit) {
    const allowed =
      (url.origin === "https://zoom.us" && url.pathname === "/oauth/token") ||
      (url.origin === "https://api.zoom.us" && url.pathname === "/v2/rooms");
    if (!allowed)
      throw new ZoomRoomsApiError(
        "policy_blocked",
        "Zoom Rooms request left its fixed endpoint boundary.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, { ...init, cache: "no-store" });
    } catch (error) {
      throw new ZoomRoomsApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Zoom Rooms request timed out."
          : "Zoom Rooms could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new ZoomRoomsApiError(
        "provider_validation_error",
        "Zoom Rooms returned more than 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const body = this.object(parsed);
    if (!response.ok)
      throw new ZoomRoomsApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    return body;
  }
  private require(value: string, label: string) {
    if (!value)
      throw new ZoomRoomsApiError(
        "credential_missing",
        `${label} is required.`,
        401,
      );
  }
  private limit(value: unknown) {
    const number = Number(value ?? 25);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), 1), 25)
      : 25;
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
      return "Zoom Rooms authorization is invalid or expired.";
    if (status === 403)
      return `Zoom Rooms requires ${ZOOM_ROOMS_REQUIRED_SCOPE}, an authorized account role, and licensing.`;
    if (status === 429) return "Zoom rate limited the Zoom Rooms request.";
    if (status >= 500) return "Zoom Rooms is temporarily unavailable.";
    return "Zoom rejected the Zoom Rooms request.";
  }
}
