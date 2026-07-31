import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export type OmnisendBoundaries = { contactId: string; campaignId: string };
export class OmnisendApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
@Injectable()
export class OmnisendApiAdapter {
  private readonly origin = "https://api.omnisend.com";
  private readonly version = "2026-03-15";
  async health(accessToken: string, boundaries: OmnisendBoundaries) {
    return this.getCampaignSummary(accessToken, boundaries);
  }
  async getContactSummary(accessToken: string, boundaries: OmnisendBoundaries) {
    this.validate(accessToken, boundaries);
    const row = await this.get(
      accessToken,
      `/api/contacts/${boundaries.contactId}`,
    );
    return {
      contact: {
        id: this.exactId(row.id, boundaries.contactId, "contact"),
        createdAt: this.text(row.createdAt, 64),
        updatedAt: this.text(row.updatedAt, 64),
        personalFieldsIncluded: false,
      },
    };
  }
  async getCampaignSummary(
    accessToken: string,
    boundaries: OmnisendBoundaries,
  ) {
    this.validate(accessToken, boundaries);
    const row = await this.get(
      accessToken,
      `/api/campaigns/${boundaries.campaignId}`,
    );
    return {
      campaign: {
        id: this.exactId(row.id, boundaries.campaignId, "campaign"),
        type: this.text(row.type, 32),
        channel: this.text(row.channel, 32),
        status: this.text(row.status, 32),
        createdAt: this.text(row.createdAt, 64),
        updatedAt: this.text(row.updatedAt, 64),
        scheduledAt: this.text(row.scheduledAt, 64),
        sentAt: this.text(row.sentAt, 64),
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
      throw new OmnisendApiError(
        "policy_blocked",
        "Omnisend requests must stay on one approved selected-resource path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Omnisend-Version": this.version,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new OmnisendApiError(
        "provider_unavailable",
        "Omnisend could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new OmnisendApiError(
        "policy_blocked",
        "Omnisend response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new OmnisendApiError(
        this.safeCode(response.status),
        `Omnisend returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value);
  }
  private validate(accessToken: string, value: OmnisendBoundaries) {
    if (
      !accessToken ||
      accessToken.length > 12_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new OmnisendApiError(
        "credential_missing",
        "A valid encrypted Omnisend OAuth access token is required.",
        401,
      );
    if (!this.id(value.contactId) || !this.id(value.campaignId))
      throw new OmnisendApiError(
        "provider_validation_error",
        "Omnisend requires exact 24-character hexadecimal contact and campaign IDs.",
        400,
      );
  }
  private exactId(value: unknown, expected: string, kind: string) {
    if (value !== expected)
      throw new OmnisendApiError(
        "provider_validation_error",
        `Omnisend returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return expected;
  }
  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new OmnisendApiError(
        "provider_validation_error",
        "Omnisend returned an invalid selected resource.",
        502,
      );
    return value as JsonObject;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }
  private id(value: string) {
    return /^[a-f0-9]{24}$/.test(value);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 410) return "policy_blocked";
    if (status === 404 || status === 400 || status === 409 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
