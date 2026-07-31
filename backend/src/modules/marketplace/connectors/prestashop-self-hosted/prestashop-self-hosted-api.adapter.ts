import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type PrestaShopSelfHostedCredentials = {
  shopBaseUrl: string;
  webserviceKey: string;
  productId: string;
};

export class PrestaShopSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PrestaShopSelfHostedApiAdapter {
  async health(credentials: PrestaShopSelfHostedCredentials) {
    return this.getSelectedProductAvailability(credentials);
  }

  async getSelectedProductAvailability(
    credentials: PrestaShopSelfHostedCredentials,
  ) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/api/products`;
    const url = new URL(path, `${boundary.origin}/`);
    url.searchParams.set("filter[id]", `[${boundary.productId}]`);
    url.searchParams.set("display", "[id,active,available_for_order]");
    url.searchParams.set("output_format", "JSON");
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.hash ||
      url.searchParams.size !== 3 ||
      url.searchParams.get("filter[id]") !== `[${boundary.productId}]` ||
      url.searchParams.get("display") !== "[id,active,available_for_order]" ||
      url.searchParams.get("output_format") !== "JSON"
    )
      throw new PrestaShopSelfHostedApiError(
        "policy_blocked",
        "PrestaShop requests must stay on the approved selected-product projection.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${boundary.webserviceKey}:`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new PrestaShopSelfHostedApiError(
        "provider_unavailable",
        "PrestaShop Webservice API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new PrestaShopSelfHostedApiError(
        "policy_blocked",
        "PrestaShop response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new PrestaShopSelfHostedApiError(
        this.safeCode(response.status),
        `PrestaShop Webservice API returned HTTP ${response.status}.`,
        response.status,
      );
    const root = this.object(value, "Webservice response");
    if (!Array.isArray(root.products) || root.products.length !== 1)
      throw new PrestaShopSelfHostedApiError(
        "provider_validation_error",
        "PrestaShop did not return exactly one selected product.",
        502,
      );
    const product = this.object(root.products[0], "selected product");
    if (String(product.id) !== boundary.productId)
      throw new PrestaShopSelfHostedApiError(
        "provider_validation_error",
        "PrestaShop returned a different product than the selected product.",
        502,
      );
    return {
      product: {
        productId: boundary.productId,
        active: this.requiredBoolean(product.active),
        availableForOrder: this.requiredBoolean(product.available_for_order),
        productContentOrPricingIncluded: false,
        customerCartOrOrderDataIncluded: false,
      },
    };
  }

  private validate(value: PrestaShopSelfHostedCredentials) {
    let url: URL;
    try {
      url = new URL(value.shopBaseUrl);
    } catch {
      throw new PrestaShopSelfHostedApiError(
        "provider_validation_error",
        "Enter a valid PrestaShop HTTPS shop base URL.",
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
      /%2f|%5c/i.test(value.shopBaseUrl)
    )
      throw new PrestaShopSelfHostedApiError(
        "policy_blocked",
        "PrestaShop requires one exact public HTTPS shop base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[A-Za-z0-9]{32}$/.test(value.webserviceKey))
      throw new PrestaShopSelfHostedApiError(
        "credential_missing",
        "PrestaShop requires one 32-character dedicated Webservice key.",
        401,
      );
    if (!/^[1-9][0-9]{0,15}$/.test(value.productId))
      throw new PrestaShopSelfHostedApiError(
        "provider_validation_error",
        "PrestaShop requires one exact positive numeric selected product ID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      webserviceKey: value.webserviceKey,
      productId: value.productId,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new PrestaShopSelfHostedApiError(
        "provider_unavailable",
        "PrestaShop host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new PrestaShopSelfHostedApiError(
        "policy_blocked",
        "PrestaShop host must resolve only to public addresses.",
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

  private requiredBoolean(value: unknown) {
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0") return false;
    throw new PrestaShopSelfHostedApiError(
      "provider_validation_error",
      "PrestaShop returned invalid selected-product availability data.",
      502,
    );
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new PrestaShopSelfHostedApiError(
        "provider_validation_error",
        `PrestaShop returned an invalid ${label}.`,
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
