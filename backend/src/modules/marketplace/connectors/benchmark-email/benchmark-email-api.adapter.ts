import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type BenchmarkEmailCredentials = {
  apiKey: string;
  apiBaseUrl: string;
  contactId: string;
  campaignId: string;
};

export class BenchmarkEmailApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class BenchmarkEmailApiAdapter {
  async health(credentials: BenchmarkEmailCredentials) {
    return this.getCampaignSummary(credentials);
  }

  async getContactSummary(credentials: BenchmarkEmailCredentials) {
    const origin = this.validate(credentials);
    const row = await this.get(
      origin,
      credentials.apiKey,
      `/api/contact/${credentials.contactId}`,
    );
    return {
      contact: {
        id: this.exactId(row._id ?? row.id, credentials.contactId, "contact"),
        createdAt: this.text(row.createdAt, 64),
        updatedAt: this.text(row.updatedAt, 64),
        personalFieldsIncluded: false,
      },
    };
  }

  async getCampaignSummary(credentials: BenchmarkEmailCredentials) {
    const origin = this.validate(credentials);
    const row = await this.get(
      origin,
      credentials.apiKey,
      `/api/email/campaign/${credentials.campaignId}`,
    );
    return {
      campaign: {
        id: this.exactId(row._id ?? row.id, credentials.campaignId, "campaign"),
        status: this.text(row.status, 64),
        createdAt: this.text(row.createdAt, 64),
        updatedAt: this.text(row.updatedAt, 64),
        scheduledAt: this.text(row.scheduledAt, 64),
        cancelledAt: this.text(row.cancelledAt, 64),
        privateCampaignDetailsIncluded: false,
      },
    };
  }

  private async get(origin: string, apiKey: string, path: string) {
    const url = new URL(path, origin);
    if (
      url.origin !== origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new BenchmarkEmailApiError(
        "policy_blocked",
        "Benchmark Email requests must stay on one approved selected-resource path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json", "X-API-Key": apiKey },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new BenchmarkEmailApiError(
        "provider_unavailable",
        "Benchmark Email could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new BenchmarkEmailApiError(
        "policy_blocked",
        "Benchmark Email response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new BenchmarkEmailApiError(
        this.safeCode(response.status),
        `Benchmark Email returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value, "selected resource");
  }

  private validate(value: BenchmarkEmailCredentials) {
    if (!/^bme_[a-z]{2}_[A-Za-z0-9]{43}$/.test(value.apiKey))
      throw new BenchmarkEmailApiError(
        "credential_missing",
        "A valid encrypted Benchmark Email API key is required.",
        401,
      );
    let url: URL;
    try {
      url = new URL(value.apiBaseUrl);
    } catch {
      throw new BenchmarkEmailApiError(
        "provider_validation_error",
        "Benchmark Email requires the exact regional API base URL shown with the API key.",
        400,
      );
    }
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !/^api-[a-z0-9]+(?:-[a-z0-9]+)*\.benchmarkemail\.io$/.test(url.hostname)
    )
      throw new BenchmarkEmailApiError(
        "provider_validation_error",
        "Benchmark Email requires an approved regional benchmarkemail.io API origin.",
        400,
      );
    if (!this.id(value.contactId) || !this.id(value.campaignId))
      throw new BenchmarkEmailApiError(
        "provider_validation_error",
        "Benchmark Email requires exact non-email contact and campaign IDs.",
        400,
      );
    return url.origin;
  }

  private exactId(value: unknown, expected: string, kind: string) {
    if (value !== expected)
      throw new BenchmarkEmailApiError(
        "provider_validation_error",
        `Benchmark Email returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return expected;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new BenchmarkEmailApiError(
        "provider_validation_error",
        `Benchmark Email returned an invalid ${label}.`,
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
