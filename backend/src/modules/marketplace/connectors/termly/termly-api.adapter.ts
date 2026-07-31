import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type TermlyCredentials = {
  publicKey: string;
  privateKey: string;
  accountId: string;
  websiteId: string;
};

export class TermlyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TermlyApiAdapter {
  async health(credentials: TermlyCredentials) {
    return this.getWebsiteSummary(credentials);
  }

  async getWebsiteSummary(credentials: TermlyCredentials) {
    const row = this.first(await this.request(credentials, "/v1/websites"));
    return { website: this.websiteSummary(row) };
  }

  async getBannerSummary(credentials: TermlyCredentials) {
    const row = this.first(await this.request(credentials, "/v1/banners"));
    return { banner: this.bannerSummary(row) };
  }

  private async request(
    credentials: TermlyCredentials,
    path: "/v1/websites" | "/v1/banners",
  ): Promise<unknown> {
    this.validate(credentials);
    const query = encodeURIComponent(
      JSON.stringify([
        { account_id: credentials.accountId, ids: [credentials.websiteId] },
      ]),
    );
    const timestamp = this.timestamp(new Date());
    const authorization = this.authorization(
      credentials,
      timestamp,
      path,
      query,
    );
    const url = new URL(`${path}?query=${query}`, "https://api.termly.io");
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
          "X-Termly-Timestamp": timestamp,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new TermlyApiError(
        "provider_unavailable",
        "Termly could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new TermlyApiError(
        "policy_blocked",
        "Termly response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new TermlyApiError(
        this.safeCode(response.status),
        `Termly returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private authorization(
    credentials: TermlyCredentials,
    timestamp: string,
    path: string,
    query: string,
  ) {
    const key0 = createHmac("sha256", credentials.privateKey)
      .update(timestamp)
      .digest();
    const key1 = createHmac("sha256", key0).update("default").digest();
    const derived = createHmac("sha256", key1).update("termly").digest();
    const bodyHash = createHash("sha256").update("").digest("hex");
    const canonical = [
      "GET",
      "api.termly.io",
      path,
      query,
      timestamp,
      bodyHash,
    ].join("\n");
    const signature = createHmac("sha256", derived)
      .update(canonical)
      .digest("hex");
    return `TermlyV1, PublicKey=${credentials.publicKey}, Signature=${signature}`;
  }

  private validate(credentials: TermlyCredentials) {
    if (!this.key(credentials.publicKey) || !this.key(credentials.privateKey))
      throw new TermlyApiError(
        "credential_missing",
        "Valid encrypted Termly partner keys are required.",
        401,
      );
    if (!/^acct_[A-Za-z0-9-]{1,100}$/.test(credentials.accountId))
      throw new TermlyApiError(
        "provider_validation_error",
        "Termly account ID must be one exact acct_ identifier.",
        400,
      );
    if (!/^web_[A-Za-z0-9-]{1,100}$/.test(credentials.websiteId))
      throw new TermlyApiError(
        "provider_validation_error",
        "Termly website ID must be one exact web_ identifier.",
        400,
      );
  }

  private first(value: unknown): JsonObject {
    if (!this.isObject(value) || !Array.isArray(value.results))
      throw new TermlyApiError(
        "provider_validation_error",
        "Termly returned an invalid bounded result.",
        502,
      );
    const row = value.results.find((item): item is JsonObject =>
      this.isObject(item),
    );
    if (!row)
      throw new TermlyApiError(
        "provider_validation_error",
        "The selected Termly website was not returned.",
        404,
      );
    return row;
  }

  private websiteSummary(value: JsonObject) {
    const report = this.isObject(value.report) ? value.report : {};
    return {
      id: this.text(value.id, 120),
      name: this.text(value.name, 200),
      url: this.text(value.url, 500),
      scanPeriod: this.text(value.scan_period, 50),
      cookieCount: this.number(value.cookie_count),
      unclassifiedCookieCount: this.number(value.unclassified_cookie_count),
      consentCount: this.number(value.consent_count),
      lastReportAt: this.text(report.created_at, 100),
    };
  }

  private bannerSummary(value: JsonObject) {
    return {
      websiteId: this.text(value.website_id, 120),
      position: this.text(value.position, 50),
      displayStyle: this.text(value.display_style, 50),
      size: this.text(value.size, 50),
      personalizedContent: this.boolean(value.personalized_content),
      runningTargetedAdvertising: this.boolean(
        value.running_targeted_advertising,
      ),
      sharesDataWithThirdParties: this.boolean(value.share_data_to_3rd_party),
      selectedLanguages: Array.isArray(value.selected_languages)
        ? value.selected_languages
            .filter((item): item is string => typeof item === "string")
            .slice(0, 30)
            .map((item) => item.slice(0, 20))
        : [],
    };
  }

  private timestamp(date: Date) {
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  }
  private key(value: string) {
    return Boolean(value) && value.length <= 8000 && !/[\r\n]/.test(value);
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }
  private isObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
