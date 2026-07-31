import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type MagentoSelfHostedCredentials = {
  commerceBaseUrl: string;
  productSku: string;
};

export class MagentoSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

const SELECTED_PRODUCT_QUERY = `query RelaySelectedProductStock($sku: String!) {
  products(filter: { sku: { eq: $sku } }, pageSize: 1) {
    total_count
    items {
      sku
      stock_status
    }
  }
}`;

@Injectable()
export class MagentoSelfHostedApiAdapter {
  async health(credentials: MagentoSelfHostedCredentials) {
    return this.getSelectedProductStock(credentials);
  }

  async getSelectedProductStock(credentials: MagentoSelfHostedCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/graphql`;
    const url = new URL(path, `${boundary.origin}/`);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new MagentoSelfHostedApiError(
        "policy_blocked",
        "Magento requests must stay on the approved GraphQL endpoint.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: SELECTED_PRODUCT_QUERY,
          variables: { sku: boundary.productSku },
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MagentoSelfHostedApiError(
        "provider_unavailable",
        "Magento GraphQL API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new MagentoSelfHostedApiError(
        "policy_blocked",
        "Magento response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new MagentoSelfHostedApiError(
        this.safeCode(response.status),
        `Magento GraphQL API returned HTTP ${response.status}.`,
        response.status,
      );
    const root = this.object(value, "GraphQL response");
    if (Array.isArray(root.errors) && root.errors.length)
      throw new MagentoSelfHostedApiError(
        "provider_validation_error",
        "Magento rejected the selected-product stock query.",
        502,
      );
    const data = this.object(root.data, "GraphQL data");
    const products = this.object(data.products, "products result");
    if (products.total_count !== 1)
      throw new MagentoSelfHostedApiError(
        "provider_validation_error",
        "Magento did not return exactly one selected product.",
        502,
      );
    if (!Array.isArray(products.items) || products.items.length !== 1)
      throw new MagentoSelfHostedApiError(
        "provider_validation_error",
        "Magento returned an invalid selected-product result.",
        502,
      );
    const product = this.object(products.items[0], "selected product");
    if (product.sku !== boundary.productSku)
      throw new MagentoSelfHostedApiError(
        "provider_validation_error",
        "Magento returned a different product than the selected SKU.",
        502,
      );
    const stockStatus = product.stock_status;
    if (stockStatus !== "IN_STOCK" && stockStatus !== "OUT_OF_STOCK")
      throw new MagentoSelfHostedApiError(
        "provider_validation_error",
        "Magento returned an invalid selected-product stock status.",
        502,
      );
    return {
      product: {
        productSku: boundary.productSku,
        stockStatus,
        inStock: stockStatus === "IN_STOCK",
        productContentOrPricingIncluded: false,
        customerCartOrOrderDataIncluded: false,
      },
    };
  }

  private validate(value: MagentoSelfHostedCredentials) {
    let url: URL;
    try {
      url = new URL(value.commerceBaseUrl);
    } catch {
      throw new MagentoSelfHostedApiError(
        "provider_validation_error",
        "Enter a valid Magento HTTPS commerce base URL.",
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
      /%2f|%5c/i.test(value.commerceBaseUrl)
    )
      throw new MagentoSelfHostedApiError(
        "policy_blocked",
        "Magento requires one exact public HTTPS commerce base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value.productSku))
      throw new MagentoSelfHostedApiError(
        "provider_validation_error",
        "Magento requires one exact selected product SKU using only letters, numbers, dot, underscore, or hyphen.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      productSku: value.productSku,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new MagentoSelfHostedApiError(
        "provider_unavailable",
        "Magento host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new MagentoSelfHostedApiError(
        "policy_blocked",
        "Magento host must resolve only to public addresses.",
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
      throw new MagentoSelfHostedApiError(
        "provider_validation_error",
        `Magento returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 400 || status === 404 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
