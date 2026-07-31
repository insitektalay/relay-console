import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type MailerLiteCredentials = {
  apiToken: string;
  subscriberId: string;
  campaignId: string;
};

export class MailerLiteApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MailerLiteApiAdapter {
  private readonly origin = "https://connect.mailerlite.com";

  async health(credentials: MailerLiteCredentials) {
    return this.getCampaignSummary(credentials);
  }

  async getSubscriberSummary(credentials: MailerLiteCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials.apiToken,
      `/api/subscribers/${credentials.subscriberId}`,
    );
    return {
      subscriber: {
        id: this.exactId(row.id, credentials.subscriberId, "subscriber"),
        createdAt: this.text(row.created_at, 64),
        updatedAt: this.text(row.updated_at, 64),
        personalFieldsIncluded: false,
      },
    };
  }

  async getCampaignSummary(credentials: MailerLiteCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials.apiToken,
      `/api/campaigns/${credentials.campaignId}`,
    );
    return {
      campaign: {
        id: this.exactId(row.id, credentials.campaignId, "campaign"),
        name: this.text(row.name, 255),
        type: this.text(row.type, 64),
        status: this.text(row.status, 64),
        createdAt: this.text(row.created_at, 64),
        updatedAt: this.text(row.updated_at, 64),
        privateCampaignDetailsIncluded: false,
      },
    };
  }

  private async get(apiToken: string, path: string) {
    const url = new URL(path, this.origin);
    if (
      url.origin !== this.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new MailerLiteApiError(
        "policy_blocked",
        "MailerLite requests must stay on one approved selected-resource path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          "X-Version": "2026-07-17",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MailerLiteApiError(
        "provider_unavailable",
        "MailerLite could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new MailerLiteApiError(
        "policy_blocked",
        "MailerLite response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new MailerLiteApiError(
        this.safeCode(response.status),
        `MailerLite returned HTTP ${response.status}.`,
        response.status,
      );
    const envelope = this.object(value, "response");
    return this.object(envelope.data, "selected resource");
  }

  private validate(value: MailerLiteCredentials) {
    if (!this.secret(value.apiToken, 12_000))
      throw new MailerLiteApiError(
        "credential_missing",
        "A valid encrypted MailerLite API token is required.",
        401,
      );
    if (!this.id(value.subscriberId) || !this.id(value.campaignId))
      throw new MailerLiteApiError(
        "provider_validation_error",
        "MailerLite requires one exact numeric subscriber ID and campaign ID.",
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
      throw new MailerLiteApiError(
        "provider_validation_error",
        `MailerLite returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return actual;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new MailerLiteApiError(
        "provider_validation_error",
        `MailerLite returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private id(value: string) {
    return /^[1-9][0-9]{0,19}$/.test(value);
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
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
