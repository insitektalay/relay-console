import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export type MoosendCredentials = {
  apiKey: string;
  mailingListId: string;
  subscriberId: string;
  campaignId: string;
};
export class MoosendApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
@Injectable()
export class MoosendApiAdapter {
  private readonly origin = "https://api.moosend.com";
  async health(credentials: MoosendCredentials) {
    return this.getCampaignSummary(credentials);
  }
  async getSubscriberSummary(credentials: MoosendCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials.apiKey,
      `/v3/subscribers/${credentials.mailingListId}/find/${credentials.subscriberId}.json`,
    );
    return {
      subscriber: {
        id: this.exactId(row.ID, credentials.subscriberId, "subscriber"),
        createdOn: this.text(row.CreatedOn, 96),
        updatedOn: this.text(row.UpdatedOn, 96),
        personalFieldsIncluded: false,
      },
    };
  }
  async getCampaignSummary(credentials: MoosendCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials.apiKey,
      `/v3/campaigns/${credentials.campaignId}/view.json`,
    );
    return {
      campaign: {
        id: this.exactId(row.ID, credentials.campaignId, "campaign"),
        status: this.text(row.Status, 64),
        createdOn: this.text(row.CreatedOn, 96),
        deliveredOn: this.text(row.DeliveredOn, 96),
        isTransactional:
          typeof row.IsTransactional === "boolean" ? row.IsTransactional : null,
        privateMessageDetailsIncluded: false,
      },
    };
  }
  private async get(apiKey: string, path: string) {
    const url = new URL(path, this.origin);
    url.searchParams.set("apikey", apiKey);
    if (
      url.origin !== this.origin ||
      url.pathname !== path ||
      url.hash ||
      [...url.searchParams.keys()].join() !== "apikey"
    )
      throw new MoosendApiError(
        "policy_blocked",
        "Moosend requests must stay on one approved selected-resource path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MoosendApiError(
        "provider_unavailable",
        "Moosend could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new MoosendApiError(
        "policy_blocked",
        "Moosend response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new MoosendApiError(
        this.safeCode(response.status),
        `Moosend returned HTTP ${response.status}.`,
        response.status,
      );
    const envelope = this.object(value, "response");
    if (envelope.Code !== 0 || envelope.Error)
      throw new MoosendApiError(
        "provider_validation_error",
        "Moosend rejected the selected-resource request.",
        400,
      );
    return this.object(envelope.Context, "selected resource");
  }
  private validate(value: MoosendCredentials) {
    if (
      !value.apiKey ||
      value.apiKey.length > 512 ||
      /[\r\n]/.test(value.apiKey)
    )
      throw new MoosendApiError(
        "credential_missing",
        "A valid encrypted Moosend API key is required.",
        401,
      );
    if (
      !this.id(value.mailingListId) ||
      !this.id(value.subscriberId) ||
      !this.id(value.campaignId)
    )
      throw new MoosendApiError(
        "provider_validation_error",
        "Moosend requires exact mailing-list, subscriber, and campaign IDs.",
        400,
      );
  }
  private exactId(value: unknown, expected: string, kind: string) {
    if (value !== expected)
      throw new MoosendApiError(
        "provider_validation_error",
        `Moosend returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return expected;
  }
  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new MoosendApiError(
        "provider_validation_error",
        `Moosend returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }
  private id(value: string) {
    return /^[A-Za-z0-9-]{1,96}$/.test(value);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
