import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type GetResponseBoundaries = { contactId: string; newsletterId: string };

export class GetResponseApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GetResponseApiAdapter {
  private readonly origin = "https://api.getresponse.com";

  async health(accessToken: string, boundaries: GetResponseBoundaries) {
    return this.getNewsletterSummary(accessToken, boundaries);
  }

  async getContactSummary(
    accessToken: string,
    boundaries: GetResponseBoundaries,
  ) {
    this.validate(accessToken, boundaries);
    const row = await this.get(
      accessToken,
      `/v3/contacts/${boundaries.contactId}`,
    );
    return {
      contact: {
        id: this.exactId(row.contactId, boundaries.contactId, "contact"),
        createdOn: this.text(row.createdOn, 64),
        changedOn: this.text(row.changedOn, 64),
        personalFieldsIncluded: false,
      },
    };
  }

  async getNewsletterSummary(
    accessToken: string,
    boundaries: GetResponseBoundaries,
  ) {
    this.validate(accessToken, boundaries);
    const row = await this.get(
      accessToken,
      `/v3/newsletters/${boundaries.newsletterId}`,
    );
    return {
      newsletter: {
        id: this.exactId(
          row.newsletterId,
          boundaries.newsletterId,
          "newsletter",
        ),
        type: this.text(row.type, 64),
        status: this.text(row.status, 64),
        createdOn: this.text(row.createdOn, 64),
        sendOn: this.text(row.sendOn, 64),
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
      throw new GetResponseApiError(
        "policy_blocked",
        "GetResponse requests must stay on one approved selected-resource path.",
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
      throw new GetResponseApiError(
        "provider_unavailable",
        "GetResponse could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new GetResponseApiError(
        "policy_blocked",
        "GetResponse response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new GetResponseApiError(
        this.safeCode(response.status),
        `GetResponse returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value);
  }

  private validate(accessToken: string, value: GetResponseBoundaries) {
    if (
      !accessToken ||
      accessToken.length > 12_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new GetResponseApiError(
        "credential_missing",
        "A valid encrypted GetResponse OAuth access token is required.",
        401,
      );
    if (!this.id(value.contactId) || !this.id(value.newsletterId))
      throw new GetResponseApiError(
        "provider_validation_error",
        "GetResponse requires one exact contact ID and newsletter ID.",
        400,
      );
  }
  private exactId(value: unknown, expected: string, kind: string) {
    if (value !== expected)
      throw new GetResponseApiError(
        "provider_validation_error",
        `GetResponse returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return expected;
  }
  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new GetResponseApiError(
        "provider_validation_error",
        "GetResponse returned an invalid selected resource.",
        502,
      );
    return value as JsonObject;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }
  private id(value: string) {
    return /^[A-Za-z0-9]{1,64}$/.test(value);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400 || status === 409)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
