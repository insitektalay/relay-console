import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type EmmaCredentials = {
  accountId: string;
  publicKey: string;
  privateKey: string;
  memberId: string;
  mailingId: string;
};

export class EmmaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class EmmaApiAdapter {
  private readonly origin = "https://api.e2ma.net";

  async health(credentials: EmmaCredentials) {
    return this.getMailingSummary(credentials);
  }

  async getMemberSummary(credentials: EmmaCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials,
      `/${credentials.accountId}/members/${credentials.memberId}`,
    );
    return {
      member: {
        id: this.exactId(row.member_id, credentials.memberId, "member"),
        accountId: this.exactId(
          row.account_id,
          credentials.accountId,
          "account",
        ),
        memberSince: this.text(row.member_since, 64),
        lastModifiedAt: this.text(row.last_modified_at, 64),
        privateMemberDetailsIncluded: false,
      },
    };
  }

  async getMailingSummary(credentials: EmmaCredentials) {
    this.validate(credentials);
    const row = await this.get(
      credentials,
      `/${credentials.accountId}/mailings/${credentials.mailingId}`,
    );
    return {
      mailing: {
        id: this.exactId(row.mailing_id, credentials.mailingId, "mailing"),
        accountId: this.exactId(
          row.account_id,
          credentials.accountId,
          "account",
        ),
        status: this.text(row.mailing_status, 32),
        type: this.text(row.mailing_type, 16),
        createdAt: this.text(row.created_ts, 64),
        sendAt: this.text(row.send_at, 64),
        sendStartedAt: this.text(row.send_started, 64),
        sendFinishedAt: this.text(row.send_finished, 64),
        archivedAt: this.text(row.archived_ts, 64),
        privateMailingDetailsIncluded: false,
      },
    };
  }

  private async get(credentials: EmmaCredentials, path: string) {
    const url = new URL(path, this.origin);
    if (
      url.origin !== this.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new EmmaApiError(
        "policy_blocked",
        "Emma requests must stay on one approved selected-resource path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            `${credentials.publicKey}:${credentials.privateKey}`,
          ).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new EmmaApiError(
        "provider_unavailable",
        "Emma could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new EmmaApiError(
        "policy_blocked",
        "Emma response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new EmmaApiError(
        this.safeCode(response.status),
        `Emma returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value, "selected resource");
  }

  private validate(value: EmmaCredentials) {
    if (!this.secret(value.publicKey) || !this.secret(value.privateKey))
      throw new EmmaApiError(
        "credential_missing",
        "Valid encrypted Emma public and private API keys are required.",
        401,
      );
    if (
      !this.numericId(value.accountId) ||
      !this.numericId(value.memberId) ||
      !this.numericId(value.mailingId)
    )
      throw new EmmaApiError(
        "provider_validation_error",
        "Emma requires exact numeric account, member, and mailing IDs.",
        400,
      );
  }

  private exactId(value: unknown, expected: string, kind: string) {
    const actual = typeof value === "number" ? String(value) : value;
    if (actual !== expected)
      throw new EmmaApiError(
        "provider_validation_error",
        `Emma returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return expected;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new EmmaApiError(
        "provider_validation_error",
        `Emma returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private numericId(value: string) {
    return /^[1-9][0-9]{0,19}$/.test(value);
  }

  private secret(value: string) {
    return value.length >= 3 && value.length <= 2048 && !/[\r\n:]/.test(value);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "provider_rate_limited";
    if (status === 404 || status === 400 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
