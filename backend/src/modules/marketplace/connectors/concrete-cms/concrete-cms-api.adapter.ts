import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type ConcreteCmsCredentials = {
  siteBaseUrl: string;
  accessToken: string;
  pageId: string;
};

export class ConcreteCmsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ConcreteCmsApiAdapter {
  async health(credentials: ConcreteCmsCredentials) {
    return this.getSelectedPageLifecycle(credentials);
  }

  async getSelectedPageLifecycle(credentials: ConcreteCmsCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/ccm/api/1.0/pages/${boundary.pageId}`;
    const url = new URL(path, `${boundary.origin}/`);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new ConcreteCmsApiError(
        "policy_blocked",
        "Concrete CMS requests must stay on the approved selected-page route.",
        403,
      );

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${boundary.accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ConcreteCmsApiError(
        "provider_unavailable",
        "Concrete CMS core REST API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new ConcreteCmsApiError(
        "policy_blocked",
        "Concrete CMS response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new ConcreteCmsApiError(
        this.safeCode(response.status),
        `Concrete CMS core REST API returned HTTP ${response.status}.`,
        response.status,
      );
    const page = this.object(value, "selected page response");
    if (String(page.id) !== boundary.pageId)
      throw new ConcreteCmsApiError(
        "provider_validation_error",
        "Concrete CMS returned a different page than the selected page.",
        502,
      );
    return {
      page: {
        pageId: boundary.pageId,
        dateAdded: this.requiredText(page.date_added, "date-added value"),
        dateLastUpdated: this.requiredText(
          page.date_last_updated,
          "last-updated value",
        ),
        pageContentOrIdentityIncluded: false,
        otherSiteDataIncluded: false,
      },
    };
  }

  private validate(value: ConcreteCmsCredentials) {
    let url: URL;
    try {
      url = new URL(value.siteBaseUrl);
    } catch {
      throw new ConcreteCmsApiError(
        "provider_validation_error",
        "Enter a valid Concrete CMS HTTPS site base URL.",
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
      /%2f|%5c/i.test(value.siteBaseUrl)
    )
      throw new ConcreteCmsApiError(
        "policy_blocked",
        "Concrete CMS requires one exact public HTTPS site base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[\x21-\x7e]{32,4096}$/.test(value.accessToken))
      throw new ConcreteCmsApiError(
        "credential_missing",
        "Concrete CMS requires one valid dedicated pages:read access token.",
        401,
      );
    if (!/^[1-9][0-9]{0,15}$/.test(value.pageId))
      throw new ConcreteCmsApiError(
        "provider_validation_error",
        "Concrete CMS requires one exact positive numeric selected page ID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      accessToken: value.accessToken,
      pageId: value.pageId,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new ConcreteCmsApiError(
        "provider_unavailable",
        "Concrete CMS host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new ConcreteCmsApiError(
        "policy_blocked",
        "Concrete CMS host must resolve only to public addresses.",
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

  private requiredText(value: unknown, label: string) {
    if (typeof value !== "string" || !value.trim() || value.length > 100)
      throw new ConcreteCmsApiError(
        "provider_validation_error",
        `Concrete CMS returned an invalid ${label}.`,
        502,
      );
    return value;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ConcreteCmsApiError(
        "provider_validation_error",
        `Concrete CMS returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 400 || status === 404 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
