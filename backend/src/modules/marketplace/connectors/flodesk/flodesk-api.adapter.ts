import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type FlodeskCredentials = {
  apiKey: string;
  subscriberId: string;
  segmentId: string;
};

export class FlodeskApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FlodeskApiAdapter {
  private readonly origin = "https://api.flodesk.com";

  async health(credentials: FlodeskCredentials) {
    return this.getSegmentSummary(credentials);
  }

  async getSubscriberSummary(credentials: FlodeskCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials.apiKey,
      `/v1/subscribers/${credentials.subscriberId}`,
    );
    return {
      subscriber: {
        id: this.exactId(row.id, credentials.subscriberId, "subscriber"),
        createdAt: this.text(row.created_at, 64),
        privateSubscriberDetailsIncluded: false,
      },
    };
  }

  async getSegmentSummary(credentials: FlodeskCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials.apiKey,
      `/v1/segments/${credentials.segmentId}`,
    );
    return {
      segment: {
        id: this.exactId(row.id, credentials.segmentId, "segment"),
        createdAt: this.text(row.created_at, 64),
        privateSegmentDetailsIncluded: false,
      },
    };
  }

  private async get(apiKey: string, path: string) {
    const url = new URL(path, this.origin);
    if (
      url.origin !== this.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new FlodeskApiError(
        "policy_blocked",
        "Flodesk requests must stay on one approved selected-resource path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "User-Agent": "ClawChat Marketplace (https://clawchat.com)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new FlodeskApiError(
        "provider_unavailable",
        "Flodesk could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new FlodeskApiError(
        "policy_blocked",
        "Flodesk response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new FlodeskApiError(
        this.safeCode(response.status),
        `Flodesk returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value, "selected resource");
  }

  private validate(value: FlodeskCredentials) {
    if (
      value.apiKey.length < 8 ||
      value.apiKey.length > 2048 ||
      /[\r\n:]/.test(value.apiKey)
    )
      throw new FlodeskApiError(
        "credential_missing",
        "A valid encrypted Flodesk API key is required.",
        401,
      );
    if (!this.id(value.subscriberId) || !this.id(value.segmentId))
      throw new FlodeskApiError(
        "provider_validation_error",
        "Flodesk requires exact non-email subscriber and segment IDs.",
        400,
      );
  }

  private exactId(value: unknown, expected: string, kind: string) {
    if (value !== expected)
      throw new FlodeskApiError(
        "provider_validation_error",
        `Flodesk returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return expected;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new FlodeskApiError(
        "provider_validation_error",
        `Flodesk returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private id(value: string) {
    return /^[A-Za-z0-9_-]{1,128}$/.test(value) && !value.includes("@");
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
