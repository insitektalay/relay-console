import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type PlexPersonalMediaServerCredentials = {
  serverOrigin: string;
  token: string;
  ratingKey: string;
};

export class PlexPersonalMediaServerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PlexPersonalMediaServerApiAdapter {
  async health(credentials: PlexPersonalMediaServerCredentials) {
    return this.getSelectedItemLifecycle(credentials);
  }

  async getSelectedItemLifecycle(
    credentials: PlexPersonalMediaServerCredentials,
  ) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(new URL(boundary.origin).hostname);
    const path = `/library/metadata/${boundary.ratingKey}`;
    const url = new URL(path, boundary.origin);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new PlexPersonalMediaServerApiError(
        "policy_blocked",
        "Plex requests must stay on the approved selected-item path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Plex-Token": credentials.token,
          "X-Plex-Client-Identifier": "clawchat-marketplace-plex-personal",
          "X-Plex-Product": "ClawChat",
          "X-Plex-Pms-Api-Version": "1.0.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new PlexPersonalMediaServerApiError(
        "provider_unavailable",
        "Plex Media Server could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new PlexPersonalMediaServerApiError(
        "policy_blocked",
        "Plex response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new PlexPersonalMediaServerApiError(
        this.safeCode(response.status),
        `Plex Media Server returned HTTP ${response.status}.`,
        response.status,
      );
    const root = this.object(value, "response");
    const container = this.object(root.MediaContainer, "media container");
    if (!Array.isArray(container.Metadata) || container.Metadata.length !== 1)
      throw new PlexPersonalMediaServerApiError(
        "provider_validation_error",
        "Plex did not return exactly one selected metadata item.",
        502,
      );
    const row = this.object(container.Metadata[0], "selected metadata item");
    return {
      item: {
        ratingKey: this.exactRatingKey(row.ratingKey, boundary.ratingKey),
        type: this.mediaType(row.type),
        addedAt: this.epoch(row.addedAt),
        updatedAt: this.epoch(row.updatedAt),
        privateMediaMetadataIncluded: false,
        mediaContentIncluded: false,
      },
    };
  }

  private validate(value: PlexPersonalMediaServerCredentials) {
    let url: URL;
    try {
      url = new URL(value.serverOrigin);
    } catch {
      throw new PlexPersonalMediaServerApiError(
        "provider_validation_error",
        "Enter a valid Plex Media Server HTTPS origin.",
        400,
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "") ||
      !hostname ||
      hostname !== url.hostname.toLowerCase() ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+\.plex\.direct$/.test(hostname)
    )
      throw new PlexPersonalMediaServerApiError(
        "policy_blocked",
        "Plex requires one exact HTTPS plex.direct server origin without a path, embedded credentials, query, or fragment.",
        403,
      );
    if (
      value.token.length < 8 ||
      value.token.length > 2048 ||
      /[\r\n]/.test(value.token)
    )
      throw new PlexPersonalMediaServerApiError(
        "credential_missing",
        "A valid encrypted Plex authentication token is required.",
        401,
      );
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(value.ratingKey))
      throw new PlexPersonalMediaServerApiError(
        "provider_validation_error",
        "Plex requires one exact safe selected rating key.",
        400,
      );
    return { origin: url.origin, ratingKey: value.ratingKey };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new PlexPersonalMediaServerApiError(
        "provider_unavailable",
        "Plex Media Server DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new PlexPersonalMediaServerApiError(
        "policy_blocked",
        "Plex Media Server must resolve only to public addresses.",
        403,
      );
  }

  private publicAddress(value: string) {
    if (isIP(value) === 4) {
      const [a, b, c] = value.split(".").map(Number);
      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0 && (c === 0 || c === 2)) ||
        (a === 192 && b === 88 && c === 99) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113)
      );
    }
    if (isIP(value) === 6) {
      const normalized = value.toLowerCase();
      return !(
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fe8") ||
        normalized.startsWith("fe9") ||
        normalized.startsWith("fea") ||
        normalized.startsWith("feb") ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("ff") ||
        normalized.startsWith("2001:db8:") ||
        normalized.startsWith("::ffff:")
      );
    }
    return false;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new PlexPersonalMediaServerApiError(
        "provider_validation_error",
        `Plex returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private exactRatingKey(value: unknown, expected: string) {
    if (value !== expected)
      throw new PlexPersonalMediaServerApiError(
        "provider_validation_error",
        "Plex returned a different item than the selected item.",
        502,
      );
    return expected;
  }

  private mediaType(value: unknown) {
    return typeof value === "string" && /^[a-z]{1,32}$/.test(value)
      ? value
      : null;
  }

  private epoch(value: unknown) {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
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
