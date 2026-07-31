import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type AWeberBoundaries = {
  accountId: string;
  listId: string;
  subscriberId: string;
  campaignType: string;
  campaignId: string;
};

export class AWeberApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AWeberApiAdapter {
  private readonly origin = "https://api.aweber.com";

  async health(accessToken: string, boundaries: AWeberBoundaries) {
    return this.getCampaignSummary(accessToken, boundaries);
  }

  async getSubscriberSummary(
    accessToken: string,
    boundaries: AWeberBoundaries,
  ) {
    this.validate(accessToken, boundaries);
    const row = await this.get(
      accessToken,
      `/1.0/accounts/${boundaries.accountId}/lists/${boundaries.listId}/subscribers/${boundaries.subscriberId}`,
    );
    return {
      subscriber: {
        id: this.exactId(row.id, boundaries.subscriberId, "subscriber"),
        subscribedAt: this.text(row.subscribed_at, 64),
        personalFieldsIncluded: false,
      },
    };
  }

  async getCampaignSummary(accessToken: string, boundaries: AWeberBoundaries) {
    this.validate(accessToken, boundaries);
    const row = await this.get(
      accessToken,
      `/1.0/accounts/${boundaries.accountId}/lists/${boundaries.listId}/campaigns/${boundaries.campaignType}${boundaries.campaignId}`,
    );
    return {
      campaign: {
        id: this.exactId(row.id, boundaries.campaignId, "campaign"),
        campaignType: this.exactCampaignType(
          row.campaign_type,
          boundaries.campaignType,
        ),
        status: this.text(row.status, 64),
        createdAt: this.text(row.created_at, 64),
        scheduledAt: this.text(row.scheduled_at, 64),
        sentAt: this.text(row.sent_at, 64),
        privateMessageDetailsIncluded: false,
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
      throw new AWeberApiError(
        "policy_blocked",
        "AWeber requests must stay on one approved selected-resource path.",
        403,
      );
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
    } catch {
      throw new AWeberApiError(
        "provider_unavailable",
        "AWeber could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new AWeberApiError(
        "policy_blocked",
        "AWeber response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new AWeberApiError(
        this.safeCode(response.status),
        `AWeber returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value, "selected resource");
  }

  private validate(accessToken: string, value: AWeberBoundaries) {
    if (!this.secret(accessToken, 12_000))
      throw new AWeberApiError(
        "credential_missing",
        "A valid encrypted AWeber OAuth access token is required.",
        401,
      );
    if (
      !this.id(value.accountId) ||
      !this.id(value.listId) ||
      !this.id(value.subscriberId) ||
      !this.id(value.campaignId) ||
      !/^[bf]$/.test(value.campaignType)
    )
      throw new AWeberApiError(
        "provider_validation_error",
        "AWeber requires exact numeric account, list, subscriber, and campaign IDs plus campaign type b or f.",
        400,
      );
  }

  private exactId(value: unknown, expected: string, kind: string) {
    const actual =
      typeof value === "number"
        ? String(value)
        : typeof value === "string"
          ? value
          : "";
    if (actual !== expected)
      throw new AWeberApiError(
        "provider_validation_error",
        `AWeber returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return actual;
  }

  private exactCampaignType(value: unknown, expected: string) {
    if (value !== expected)
      throw new AWeberApiError(
        "provider_validation_error",
        "AWeber returned a different campaign type than the selected campaign type.",
        502,
      );
    return expected;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new AWeberApiError(
        "provider_validation_error",
        `AWeber returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private id(value: string) {
    return /^[1-9][0-9]{0,9}$/.test(value) && Number(value) <= 2_147_483_647;
  }

  private secret(value: string, maximum: number) {
    return Boolean(value) && value.length <= maximum && !/[\r\n]/.test(value);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400) return "provider_validation_error";
    if (status === 410) return "policy_blocked";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
