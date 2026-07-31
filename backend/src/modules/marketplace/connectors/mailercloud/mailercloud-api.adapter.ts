import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export type MailercloudCredentials = {
  apiKey: string;
  contactId: string;
  campaignId: string;
};
export class MailercloudApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
@Injectable()
export class MailercloudApiAdapter {
  private readonly origin = "https://cloudapi.mailercloud.com";
  async health(credentials: MailercloudCredentials) {
    return this.getCampaignSummary(credentials);
  }
  async getContactSummary(credentials: MailercloudCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials.apiKey,
      `/v1/contacts/${credentials.contactId}`,
    );
    return {
      contact: {
        id: this.exactId(
          row.id ?? row.contact_id,
          credentials.contactId,
          "contact",
        ),
        createdAt: this.text(row.created_at ?? row.createdAt, 64),
        updatedAt: this.text(row.updated_at ?? row.updatedAt, 64),
        personalFieldsIncluded: false,
      },
    };
  }
  async getCampaignSummary(credentials: MailercloudCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials.apiKey,
      `/v1/campaign/${credentials.campaignId}`,
    );
    return {
      campaign: {
        id: this.exactId(
          row.id ?? row.campaign_id,
          credentials.campaignId,
          "campaign",
        ),
        status: this.text(row.status, 64),
        createdAt: this.text(row.created_at ?? row.createdAt, 64),
        updatedAt: this.text(row.updated_at ?? row.updatedAt, 64),
        scheduledAt: this.text(row.scheduled_at ?? row.scheduledAt, 64),
        sentAt: this.text(row.sent_at ?? row.sentAt, 64),
        privateCampaignDetailsIncluded: false,
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
      throw new MailercloudApiError(
        "policy_blocked",
        "Mailercloud requests must stay on one approved selected-resource path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: apiKey },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MailercloudApiError(
        "provider_unavailable",
        "Mailercloud could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new MailercloudApiError(
        "policy_blocked",
        "Mailercloud response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new MailercloudApiError(
        this.safeCode(response.status),
        `Mailercloud returned HTTP ${response.status}.`,
        response.status,
      );
    const envelope = this.object(value, "response");
    return envelope.data
      ? this.object(envelope.data, "selected resource")
      : envelope;
  }
  private validate(value: MailercloudCredentials) {
    if (
      !value.apiKey ||
      value.apiKey.length > 2048 ||
      /[\r\n]/.test(value.apiKey)
    )
      throw new MailercloudApiError(
        "credential_missing",
        "A valid encrypted Mailercloud API key is required.",
        401,
      );
    if (!this.id(value.contactId) || !this.id(value.campaignId))
      throw new MailercloudApiError(
        "provider_validation_error",
        "Mailercloud requires exact non-email contact and campaign IDs.",
        400,
      );
  }
  private exactId(value: unknown, expected: string, kind: string) {
    const actual = typeof value === "number" ? String(value) : value;
    if (actual !== expected)
      throw new MailercloudApiError(
        "provider_validation_error",
        `Mailercloud returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return expected;
  }
  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new MailercloudApiError(
        "provider_validation_error",
        `Mailercloud returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }
  private id(value: string) {
    return /^[A-Za-z0-9_-]{1,96}$/.test(value) && !value.includes("@");
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
