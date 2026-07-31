import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type DemioCredentials = { apiKey: string; apiSecret: string };

export class DemioApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DemioApiAdapter {
  async health(credentials: DemioCredentials) {
    const result = await this.countEventInventory(credentials);
    return { authorized: true, observedEventCount: result.observedEventCount };
  }

  async countEventInventory(credentials: DemioCredentials) {
    const normalized = this.credentials(credentials);
    const url = new URL("https://my.demio.com/api/v1/events");
    if (
      url.origin !== "https://my.demio.com" ||
      url.pathname !== "/api/v1/events" ||
      url.search
    ) {
      throw new DemioApiError(
        "policy_blocked",
        "Demio request left its fixed endpoint boundary.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Api-Key": normalized.apiKey,
          "Api-Secret": normalized.apiSecret,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new DemioApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Demio request timed out."
          : "Demio could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000) {
      throw new DemioApiError(
        "provider_validation_error",
        "Demio returned more than 1 MB.",
      );
    }
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : [];
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      throw new DemioApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    }
    const object = this.object(parsed);
    const events = Array.isArray(parsed)
      ? parsed
      : Array.isArray(object.events)
        ? object.events
        : Array.isArray(object.data)
          ? object.data
          : null;
    if (!events) {
      throw new DemioApiError(
        "provider_validation_error",
        "Demio returned an unexpected event inventory shape.",
      );
    }
    return {
      observedEventCount: events.length,
      contentExcluded: true,
      completeInventory: true,
    };
  }

  private credentials(credentials: DemioCredentials) {
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!apiKey || apiKey.length > 10_000)
      throw new DemioApiError(
        "credential_missing",
        "Demio API key is required.",
        401,
      );
    if (!apiSecret || apiSecret.length > 10_000)
      throw new DemioApiError(
        "credential_missing",
        "Demio API secret is required.",
        401,
      );
    return { apiKey, apiSecret };
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private safeMessage(status: number) {
    if (status === 401 || status === 403)
      return "Demio API credentials are invalid or the account lacks API access.";
    if (status === 429) return "Demio rate limited the event request.";
    if (status >= 500) return "Demio is temporarily unavailable.";
    return "Demio rejected the event request.";
  }
}
