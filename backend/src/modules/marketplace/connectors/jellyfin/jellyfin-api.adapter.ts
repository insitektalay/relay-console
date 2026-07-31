import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type JellyfinCredentials = {
  serverBaseUrl: string;
  apiKey: string;
  itemId: string;
};

export class JellyfinApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class JellyfinApiAdapter {
  async health(credentials: JellyfinCredentials) {
    return this.getSelectedItemLifecycle(credentials);
  }

  async getSelectedItemLifecycle(credentials: JellyfinCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/Items/${boundary.itemId}`;
    const url = new URL(path, `${boundary.origin}/`);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new JellyfinApiError(
        "policy_blocked",
        "Jellyfin requests must stay on the approved selected-item path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `MediaBrowser Token="${credentials.apiKey}", Client="ClawChat", Device="Railway", DeviceId="clawchat-marketplace-jellyfin", Version="1.0.0"`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new JellyfinApiError(
        "provider_unavailable",
        "Jellyfin server could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new JellyfinApiError(
        "policy_blocked",
        "Jellyfin response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new JellyfinApiError(
        this.safeCode(response.status),
        `Jellyfin server returned HTTP ${response.status}.`,
        response.status,
      );
    const row = this.object(value, "selected item");
    return {
      item: {
        itemId: this.exactItemId(row.Id, boundary.itemId),
        type: this.mediaType(row.Type),
        dateCreated: this.isoTimestamp(row.DateCreated),
        privateMediaMetadataIncluded: false,
        mediaContentIncluded: false,
      },
    };
  }

  private validate(value: JellyfinCredentials) {
    let url: URL;
    try {
      url = new URL(value.serverBaseUrl);
    } catch {
      throw new JellyfinApiError(
        "provider_validation_error",
        "Enter a valid Jellyfin HTTPS server base URL.",
        400,
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const rawPath = url.pathname;
    const normalizedPath = rawPath === "/" ? "" : rawPath.replace(/\/$/, "");
    const safePath =
      normalizedPath === "" ||
      (/^\/(?:[A-Za-z0-9._~-]+)(?:\/[A-Za-z0-9._~-]+)*$/.test(normalizedPath) &&
        !normalizedPath
          .split("/")
          .some((part) => part === "." || part === ".."));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !hostname ||
      hostname !== url.hostname.toLowerCase() ||
      !safePath ||
      /%2f|%5c/i.test(value.serverBaseUrl)
    )
      throw new JellyfinApiError(
        "policy_blocked",
        "Jellyfin requires one exact public HTTPS server base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[A-Za-z0-9._~-]{16,512}$/.test(value.apiKey))
      throw new JellyfinApiError(
        "credential_missing",
        "A valid encrypted customer-owned Jellyfin API key is required.",
        401,
      );
    const itemId = value.itemId.replace(/-/g, "").toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(itemId))
      throw new JellyfinApiError(
        "provider_validation_error",
        "Jellyfin requires one exact selected 32-character item ID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      itemId,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new JellyfinApiError(
        "provider_unavailable",
        "Jellyfin server DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new JellyfinApiError(
        "policy_blocked",
        "Jellyfin server must resolve only to public addresses.",
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
      throw new JellyfinApiError(
        "provider_validation_error",
        `Jellyfin returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private exactItemId(value: unknown, expected: string) {
    if (
      typeof value !== "string" ||
      value.replace(/-/g, "").toLowerCase() !== expected
    )
      throw new JellyfinApiError(
        "provider_validation_error",
        "Jellyfin returned a different item than the selected item.",
        502,
      );
    return expected;
  }

  private mediaType(value: unknown) {
    return typeof value === "string" &&
      /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value)
      ? value
      : null;
  }

  private isoTimestamp(value: unknown) {
    if (
      typeof value !== "string" ||
      value.length > 64 ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
      Number.isNaN(Date.parse(value))
    )
      return null;
    return value;
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
