import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type JoomlaCredentials = {
  siteBaseUrl: string;
  apiToken: string;
  articleId: string;
};

export class JoomlaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class JoomlaApiAdapter {
  async health(credentials: JoomlaCredentials) {
    return this.getSelectedArticleLifecycle(credentials);
  }

  async getSelectedArticleLifecycle(credentials: JoomlaCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/api/index.php/v1/content/articles/${boundary.articleId}`;
    const url = new URL(path, `${boundary.origin}/`);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new JoomlaApiError(
        "policy_blocked",
        "Joomla requests must stay on the approved selected-article route.",
        403,
      );

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          "X-Joomla-Token": boundary.apiToken,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new JoomlaApiError(
        "provider_unavailable",
        "Joomla Web Services API could not be reached.",
        502,
      );
    }

    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new JoomlaApiError(
        "policy_blocked",
        "Joomla response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new JoomlaApiError(
        this.safeCode(response.status),
        `Joomla Web Services API returned HTTP ${response.status}.`,
        response.status,
      );

    const root = this.object(value, "Web Services response");
    const article = this.object(root.data, "selected article resource");
    if (
      String(article.id) !== boundary.articleId ||
      article.type !== "articles"
    )
      throw new JoomlaApiError(
        "provider_validation_error",
        "Joomla returned a different resource than the selected article.",
        502,
      );
    const attributes = this.object(article.attributes, "article attributes");
    const state = this.requiredInteger(attributes.state, "publication state");
    return {
      article: {
        articleId: boundary.articleId,
        state,
        published: state === 1,
        createdAt: this.requiredText(attributes.created, "created timestamp"),
        modifiedAt: this.optionalText(
          attributes.modified,
          "modified timestamp",
        ),
        articleContentOrIdentityIncluded: false,
        otherSiteDataIncluded: false,
      },
    };
  }

  private validate(value: JoomlaCredentials) {
    let url: URL;
    try {
      url = new URL(value.siteBaseUrl);
    } catch {
      throw new JoomlaApiError(
        "provider_validation_error",
        "Enter a valid Joomla HTTPS site base URL.",
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
      throw new JoomlaApiError(
        "policy_blocked",
        "Joomla requires one exact public HTTPS site base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[\x21-\x7e]{32,2048}$/.test(value.apiToken))
      throw new JoomlaApiError(
        "credential_missing",
        "Joomla requires one valid dedicated API token.",
        401,
      );
    if (!/^[1-9][0-9]{0,15}$/.test(value.articleId))
      throw new JoomlaApiError(
        "provider_validation_error",
        "Joomla requires one exact positive numeric selected article ID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      apiToken: value.apiToken,
      articleId: value.articleId,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new JoomlaApiError(
        "provider_unavailable",
        "Joomla host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new JoomlaApiError(
        "policy_blocked",
        "Joomla host must resolve only to public addresses.",
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

  private requiredInteger(value: unknown, label: string) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < -2 || parsed > 2)
      throw new JoomlaApiError(
        "provider_validation_error",
        `Joomla returned an invalid ${label}.`,
        502,
      );
    return parsed;
  }

  private requiredText(value: unknown, label: string) {
    if (typeof value !== "string" || !value.trim() || value.length > 100)
      throw new JoomlaApiError(
        "provider_validation_error",
        `Joomla returned an invalid ${label}.`,
        502,
      );
    return value;
  }

  private optionalText(value: unknown, label: string) {
    if (value === null || value === "" || value === undefined) return null;
    return this.requiredText(value, label);
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new JoomlaApiError(
        "provider_validation_error",
        `Joomla returned an invalid ${label}.`,
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
