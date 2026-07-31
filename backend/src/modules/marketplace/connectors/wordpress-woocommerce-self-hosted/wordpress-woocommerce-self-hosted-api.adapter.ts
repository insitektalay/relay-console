import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type WordPressWooCommerceSelfHostedCredentials = {
  storeBaseUrl: string;
  productId: string;
};

export class WordPressWooCommerceSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WordPressWooCommerceSelfHostedApiAdapter {
  async health(credentials: WordPressWooCommerceSelfHostedCredentials) {
    return this.getSelectedProductAvailability(credentials);
  }

  async getSelectedProductAvailability(
    credentials: WordPressWooCommerceSelfHostedCredentials,
  ) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/wp-json/wc/store/v1/products/${boundary.productId}`;
    const url = new URL(path, `${boundary.origin}/`);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new WordPressWooCommerceSelfHostedApiError(
        "policy_blocked",
        "WooCommerce requests must stay on the approved selected-product path.",
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
      throw new WordPressWooCommerceSelfHostedApiError(
        "provider_unavailable",
        "WooCommerce Store API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new WordPressWooCommerceSelfHostedApiError(
        "policy_blocked",
        "WooCommerce response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new WordPressWooCommerceSelfHostedApiError(
        this.safeCode(response.status),
        `WooCommerce Store API returned HTTP ${response.status}.`,
        response.status,
      );
    const row = this.object(value, "selected product");
    return {
      product: {
        productId: this.exactProductId(row.id, boundary.productId),
        isPurchasable: this.requiredBoolean(row.is_purchasable),
        isInStock: this.requiredBoolean(row.is_in_stock),
        isOnSale: this.requiredBoolean(row.is_on_sale),
        privateStoreDataIncluded: false,
        productContentOrPricingIncluded: false,
      },
    };
  }

  private validate(value: WordPressWooCommerceSelfHostedCredentials) {
    let url: URL;
    try {
      url = new URL(value.storeBaseUrl);
    } catch {
      throw new WordPressWooCommerceSelfHostedApiError(
        "provider_validation_error",
        "Enter a valid WordPress WooCommerce HTTPS store base URL.",
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
      /%2f|%5c/i.test(value.storeBaseUrl)
    )
      throw new WordPressWooCommerceSelfHostedApiError(
        "policy_blocked",
        "WooCommerce requires one exact public HTTPS store base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[1-9][0-9]{0,15}$/.test(value.productId))
      throw new WordPressWooCommerceSelfHostedApiError(
        "provider_validation_error",
        "WooCommerce requires one exact positive numeric selected product ID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      productId: value.productId,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new WordPressWooCommerceSelfHostedApiError(
        "provider_unavailable",
        "WooCommerce store DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new WordPressWooCommerceSelfHostedApiError(
        "policy_blocked",
        "WooCommerce store must resolve only to public addresses.",
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
      throw new WordPressWooCommerceSelfHostedApiError(
        "provider_validation_error",
        `WooCommerce returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private exactProductId(value: unknown, expected: string) {
    if (value !== Number(expected))
      throw new WordPressWooCommerceSelfHostedApiError(
        "provider_validation_error",
        "WooCommerce returned a different product than the selected product.",
        502,
      );
    return expected;
  }

  private requiredBoolean(value: unknown) {
    if (typeof value !== "boolean")
      throw new WordPressWooCommerceSelfHostedApiError(
        "provider_validation_error",
        "WooCommerce returned invalid selected-product availability data.",
        502,
      );
    return value;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 404 || status === 400 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
