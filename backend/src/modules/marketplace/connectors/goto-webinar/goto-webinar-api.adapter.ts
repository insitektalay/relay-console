import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GoToWebinarApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GoToWebinarApiAdapter {
  async health(accessToken: string) {
    const result = await this.listLifecycle(accessToken, { limit: 1 });
    return { authorized: true, sampleCount: result.webinars.length };
  }

  async listLifecycle(accessToken: string, input: JsonObject) {
    if (!accessToken) {
      throw new GoToWebinarApiError(
        "credential_missing",
        "GoTo Webinar OAuth access is required.",
        401,
      );
    }
    const organizerKey = await this.organizerKey(accessToken);
    const limit = this.limit(input.limit);
    const now = Date.now();
    const fromTime = new Date(now - 30 * 24 * 60 * 60 * 1_000).toISOString();
    const toTime = new Date(now + 180 * 24 * 60 * 60 * 1_000).toISOString();
    const url = new URL(
      `https://api.getgo.com/G2W/rest/v2/organizers/${encodeURIComponent(organizerKey)}/webinars`,
    );
    url.searchParams.set("fromTime", fromTime);
    url.searchParams.set("toTime", toTime);
    url.searchParams.set("page", "0");
    url.searchParams.set("size", String(limit));
    const body = await this.fetchJson(url, accessToken, "webinar_list");
    const embedded = this.object(body._embedded);
    const values = this.array(embedded.webinars);
    const webinars = values.slice(0, limit).map((value) => this.shape(value));
    return {
      webinars,
      count: webinars.length,
      window: { fromTime, toTime },
      nextPageUsed: false,
      completeInventory: false,
    };
  }

  private async organizerKey(accessToken: string) {
    const url = new URL("https://api.getgo.com/identity/v1/Users/me");
    const body = await this.fetchJson(url, accessToken, "identity");
    const key = this.numericId(body.id ?? body.userKey ?? body.organizerKey);
    if (!key) {
      throw new GoToWebinarApiError(
        "provider_validation_error",
        "GoTo did not return a usable authenticated organizer key.",
      );
    }
    return key;
  }

  private shape(value: unknown) {
    const webinar = this.object(value);
    return {
      times: this.array(webinar.times)
        .slice(0, 20)
        .map((value) => {
          const range = this.object(value);
          return {
            startTime: this.date(range.startTime),
            endTime: this.date(range.endTime),
          };
        }),
      timeZone: this.text(webinar.timeZone, 100),
      experienceType: this.enumText(webinar.experienceType, [
        "classic",
        "broadcast",
        "simulive",
        "CLASSIC",
        "BROADCAST",
        "SIMULIVE",
      ]),
      inSession: webinar.inSession === true,
      impromptu: webinar.impromptu === true,
      onDemand: webinar.isOndemand === true,
    };
  }

  private async fetchJson(
    url: URL,
    accessToken: string,
    route: "identity" | "webinar_list",
  ) {
    const allowed =
      route === "identity"
        ? url.origin === "https://api.getgo.com" &&
          url.pathname === "/identity/v1/Users/me" &&
          !url.search
        : url.origin === "https://api.getgo.com" &&
          /^\/G2W\/rest\/v2\/organizers\/[0-9]{1,20}\/webinars$/.test(
            url.pathname,
          );
    if (!allowed) {
      throw new GoToWebinarApiError(
        "policy_blocked",
        "GoTo Webinar request left its fixed endpoint boundary.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new GoToWebinarApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "GoTo Webinar request timed out."
          : "GoTo Webinar could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000) {
      throw new GoToWebinarApiError(
        "provider_validation_error",
        "GoTo Webinar returned more than 1 MB.",
      );
    }
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      throw new GoToWebinarApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    }
    return this.object(parsed);
  }

  private numericId(value: unknown) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : typeof value === "string"
          ? value.trim()
          : "";
    return /^[0-9]{1,20}$/.test(text) ? text : null;
  }

  private date(value: unknown) {
    const text = this.text(value, 40);
    return text && Number.isFinite(Date.parse(text))
      ? new Date(text).toISOString()
      : null;
  }

  private enumText(value: unknown, allowed: string[]) {
    return typeof value === "string" && allowed.includes(value) ? value : null;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
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
    if (status === 401)
      return "GoTo Webinar authorization is invalid or expired.";
    if (status === 403)
      return "GoTo Webinar requires identity:scim.me, collab:, the authenticated organizer, and an eligible Webinar subscription.";
    if (status === 429) return "GoTo rate limited the Webinar request.";
    if (status >= 500) return "GoTo Webinar is temporarily unavailable.";
    return "GoTo rejected the Webinar request.";
  }
}
