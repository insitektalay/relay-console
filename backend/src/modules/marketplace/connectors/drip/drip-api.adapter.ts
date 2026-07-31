import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type DripBoundaries = {
  accountId: string;
  subscriberId: string;
  campaignId: string;
};

export class DripApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DripApiAdapter {
  private readonly origin = "https://api.getdrip.com";

  async health(accessToken: string, boundaries: DripBoundaries) {
    return this.getCampaignSummary(accessToken, boundaries);
  }

  async getSubscriberSummary(accessToken: string, boundaries: DripBoundaries) {
    this.validate(accessToken, boundaries);
    const envelope = await this.get(
      accessToken,
      `/v2/${boundaries.accountId}/subscribers/${boundaries.subscriberId}`,
    );
    const row = this.single(envelope.subscribers, "subscriber");
    return {
      subscriber: {
        id: this.exactId(row.id, boundaries.subscriberId, "subscriber"),
        createdAt: this.text(row.created_at, 64),
        updatedAt: this.text(row.updated_at, 64),
        personalFieldsIncluded: false,
      },
    };
  }

  async getCampaignSummary(accessToken: string, boundaries: DripBoundaries) {
    this.validate(accessToken, boundaries);
    const envelope = await this.get(
      accessToken,
      `/v2/${boundaries.accountId}/campaigns/${boundaries.campaignId}`,
    );
    const row = this.single(envelope.campaigns, "campaign");
    return {
      campaign: {
        id: this.exactId(row.id, boundaries.campaignId, "campaign"),
        name: this.text(row.name, 300),
        status: this.text(row.status, 64),
        createdAt: this.text(row.created_at, 64),
        privateCampaignDetailsIncluded: false,
      },
    };
  }

  private async get(accessToken: string, path: string) {
    const url = new URL(path, this.origin);
    if (
      url.origin !== this.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new DripApiError(
        "policy_blocked",
        "Drip requests must stay on one approved selected-resource path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "Relay Console (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DripApiError(
        "provider_unavailable",
        "Drip could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new DripApiError(
        "policy_blocked",
        "Drip response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new DripApiError(
        this.safeCode(response.status),
        `Drip returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value, "response");
  }

  private validate(accessToken: string, value: DripBoundaries) {
    if (!this.secret(accessToken, 12_000))
      throw new DripApiError(
        "credential_missing",
        "A valid encrypted Drip OAuth access token is required.",
        401,
      );
    if (!this.numericId(value.accountId) || !this.numericId(value.campaignId))
      throw new DripApiError(
        "provider_validation_error",
        "Drip requires one exact numeric account ID and campaign ID.",
        400,
      );
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(value.subscriberId) ||
      (this.numericId(value.subscriberId) === false &&
        value.subscriberId.length < 6)
    )
      throw new DripApiError(
        "provider_validation_error",
        "Drip requires one exact non-email subscriber ID.",
        400,
      );
  }

  private single(value: unknown, label: string) {
    if (!Array.isArray(value) || value.length !== 1)
      throw new DripApiError(
        "provider_validation_error",
        `Drip returned an invalid selected ${label} result.`,
        502,
      );
    return this.object(value[0], label);
  }

  private exactId(value: unknown, expected: string, kind: string) {
    const actual =
      typeof value === "number"
        ? String(value)
        : typeof value === "string"
          ? value
          : "";
    if (actual !== expected)
      throw new DripApiError(
        "provider_validation_error",
        `Drip returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return actual;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new DripApiError(
        "provider_validation_error",
        `Drip returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private numericId(value: string) {
    return (
      /^[1-9][0-9]{0,15}$/.test(value) && Number.isSafeInteger(Number(value))
    );
  }

  private secret(value: string, maximum: number) {
    return Boolean(value) && value.length <= maximum && !/[\r\n]/.test(value);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
