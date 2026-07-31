import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type CalibreCredentials = {
  serverOrigin: string;
  username: string;
  password: string;
  libraryId: string;
  bookId: string;
};

export class CalibreApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CalibreApiAdapter {
  async health(credentials: CalibreCredentials) {
    return this.getSelectedBookLifecycle(credentials);
  }

  async getSelectedBookLifecycle(credentials: CalibreCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(new URL(boundary.origin).hostname);
    const path = `/ajax/book/${boundary.bookId}/${encodeURIComponent(
      boundary.libraryId,
    )}`;
    const url = new URL(`${path}?category_urls=false`, boundary.origin);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search !== "?category_urls=false" ||
      url.hash
    )
      throw new CalibreApiError(
        "policy_blocked",
        "Calibre requests must stay on the approved selected-book path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            `${credentials.username}:${credentials.password}`,
          ).toString("base64")}`,
          "User-Agent": "ClawChat Marketplace (https://clawchat.com)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new CalibreApiError(
        "provider_unavailable",
        "Calibre Content server could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new CalibreApiError(
        "policy_blocked",
        "Calibre response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new CalibreApiError(
        this.safeCode(response.status),
        `Calibre Content server returned HTTP ${response.status}.`,
        response.status,
      );
    const row = this.object(value, "selected book");
    return {
      book: {
        id: this.exactBookId(row.application_id, boundary.bookId),
        libraryId: boundary.libraryId,
        addedAt: this.text(row.timestamp, 64),
        lastModifiedAt: this.text(row.last_modified, 64),
        formatCount: this.arrayLength(row.formats),
        privateBookMetadataIncluded: false,
        bookContentIncluded: false,
      },
    };
  }

  private validate(value: CalibreCredentials) {
    let url: URL;
    try {
      url = new URL(value.serverOrigin);
    } catch {
      throw new CalibreApiError(
        "provider_validation_error",
        "Enter a valid Calibre Content server HTTPS origin.",
        400,
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "") ||
      !hostname ||
      hostname !== url.hostname.toLowerCase() ||
      this.blockedHostname(hostname)
    )
      throw new CalibreApiError(
        "policy_blocked",
        "Calibre requires one exact public HTTPS origin without a path, credentials, query, fragment, or nonstandard port.",
        403,
      );
    if (
      value.username.length < 1 ||
      value.username.length > 256 ||
      /[\r\n:]/.test(value.username) ||
      value.password.length < 8 ||
      value.password.length > 2048 ||
      /[\r\n]/.test(value.password)
    )
      throw new CalibreApiError(
        "credential_missing",
        "Valid encrypted Calibre Basic-auth credentials are required.",
        401,
      );
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(value.libraryId))
      throw new CalibreApiError(
        "provider_validation_error",
        "Calibre requires one exact safe library ID.",
        400,
      );
    const bookId = Number(value.bookId);
    if (!Number.isSafeInteger(bookId) || bookId <= 0)
      throw new CalibreApiError(
        "provider_validation_error",
        "Calibre requires one positive selected book ID.",
        400,
      );
    return {
      origin: `https://${hostname}`,
      libraryId: value.libraryId,
      bookId,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new CalibreApiError(
        "provider_unavailable",
        "Calibre Content server DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new CalibreApiError(
        "policy_blocked",
        "Calibre Content server must resolve only to public addresses.",
        403,
      );
  }

  private blockedHostname(hostname: string) {
    return (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      (isIP(hostname) > 0 && !this.publicAddress(hostname))
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
      throw new CalibreApiError(
        "provider_validation_error",
        `Calibre returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private exactBookId(value: unknown, expected: number) {
    if (value !== expected)
      throw new CalibreApiError(
        "provider_validation_error",
        "Calibre returned a different book than the selected book.",
        502,
      );
    return expected;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private arrayLength(value: unknown) {
    return Array.isArray(value) && value.length <= 1_000 ? value.length : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
