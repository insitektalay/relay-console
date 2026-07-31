import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type WooCommerceCredentials = {
  storeOrigin: string;
  consumerKey: string;
  consumerSecret: string;
};

export class WooCommerceApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WooCommerceApiAdapter {
  async health(credentials: WooCommerceCredentials) {
    const result = await this.request(credentials, "GET", "/system_status");
    return this.object(result.data) ?? result.data;
  }

  async listProducts(
    credentials: WooCommerceCredentials,
    input: JsonObject = {},
  ) {
    const page = this.integer(input.page, 1, 1, 10_000);
    const perPage = this.integer(input.maxResults, 25, 1, 25);
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      orderby: "modified",
      order: "desc",
    });
    const result = await this.request(credentials, "GET", `/products?${query}`);
    return {
      products: this.array(result.data)
        .slice(0, 25)
        .map((value) => this.product(value)),
      pagination: {
        page,
        total: this.headerInteger(result.headers, "x-wp-total"),
        totalPages: this.headerInteger(result.headers, "x-wp-totalpages"),
      },
    };
  }

  async getProduct(credentials: WooCommerceCredentials, input: JsonObject) {
    const result = await this.request(
      credentials,
      "GET",
      `/products/${this.positiveId(input.productId, "productId")}`,
    );
    return { product: this.product(result.data) };
  }

  async listCategories(credentials: WooCommerceCredentials) {
    const result = await this.request(
      credentials,
      "GET",
      "/products/categories?per_page=25&orderby=name&order=asc",
    );
    return {
      categories: this.array(result.data)
        .slice(0, 25)
        .map((value) => this.safe(value)),
    };
  }

  prepareProductChange(credentials: WooCommerceCredentials, input: JsonObject) {
    this.requireCredentials(credentials);
    const prepared = this.normalized(input);
    return {
      ...prepared,
      payloadHash: createHash("sha256")
        .update(JSON.stringify(prepared))
        .digest("hex"),
      providerSideEffect: false,
    };
  }

  async createDraftProduct(
    credentials: WooCommerceCredentials,
    input: JsonObject,
  ) {
    const result = await this.request(credentials, "POST", "/products", {
      ...this.editable(input),
      status: "draft",
    });
    return { product: this.product(result.data), contentState: "draft" };
  }

  async updateDraftProduct(
    credentials: WooCommerceCredentials,
    input: JsonObject,
  ) {
    const id = this.positiveId(input.productId, "productId");
    await this.assertDraftState(
      credentials,
      id,
      this.timestamp(input.expectedDateModifiedGMT),
    );
    const result = await this.request(credentials, "PUT", `/products/${id}`, {
      ...this.editable(input),
      status: "draft",
    });
    return { product: this.product(result.data), contentState: "draft" };
  }

  async publishProduct(credentials: WooCommerceCredentials, input: JsonObject) {
    const id = this.positiveId(input.productId, "productId");
    await this.assertDraftState(
      credentials,
      id,
      this.timestamp(input.expectedDateModifiedGMT),
    );
    const result = await this.request(credentials, "PUT", `/products/${id}`, {
      status: "publish",
    });
    return { product: this.product(result.data), contentState: "published" };
  }

  private async assertDraftState(
    credentials: WooCommerceCredentials,
    id: number,
    expected: string,
  ) {
    const current = this.object(
      (await this.request(credentials, "GET", `/products/${id}`)).data,
    );
    if (!current)
      throw new WooCommerceApiError(
        "provider_validation_error",
        "WooCommerce did not return the requested product.",
        404,
      );
    if (current.status !== "draft")
      throw new WooCommerceApiError(
        "policy_blocked",
        "WooCommerce product must be a draft for this operation.",
        403,
      );
    if (current.date_modified_gmt !== expected)
      throw new WooCommerceApiError(
        "approval_mismatch",
        "The WooCommerce product changed after it was reviewed; reload it before retrying.",
        409,
      );
  }

  private normalized(input: JsonObject) {
    const operation = this.enumValue(input.operation, [
      "create",
      "update",
      "publish",
    ]);
    if (operation === "create") return { operation, ...this.editable(input) };
    const productId = this.positiveId(input.productId, "productId");
    const expectedDateModifiedGMT = this.timestamp(
      input.expectedDateModifiedGMT,
    );
    if (operation === "update")
      return {
        operation,
        productId,
        expectedDateModifiedGMT,
        ...this.editable(input),
      };
    return { operation, productId, expectedDateModifiedGMT };
  }

  private editable(input: JsonObject) {
    const output: JsonObject = {
      name: this.requiredText(input.name, 255, "name"),
    };
    if (input.slug !== undefined) {
      const slug = this.optionalText(input.slug, 255, "slug");
      if (slug && !/^[a-z0-9-]+$/.test(slug))
        throw new WooCommerceApiError(
          "provider_validation_error",
          "WooCommerce slug must contain lowercase letters, numbers, and hyphens only.",
        );
      output.slug = slug;
    }
    if (input.description !== undefined)
      output.description = this.optionalText(
        input.description,
        20_000,
        "description",
      );
    if (input.shortDescription !== undefined)
      output.short_description = this.optionalText(
        input.shortDescription,
        20_000,
        "shortDescription",
      );
    if (input.categoryIds !== undefined)
      output.categories = this.ids(input.categoryIds, "categoryIds").map(
        (id) => ({ id }),
      );
    if (input.tagIds !== undefined)
      output.tags = this.ids(input.tagIds, "tagIds").map((id) => ({ id }));
    return output;
  }

  private async request(
    credentials: WooCommerceCredentials,
    method: "GET" | "POST" | "PUT",
    path: string,
    bodyObject?: JsonObject,
  ) {
    const origin = this.storeOrigin(credentials.storeOrigin);
    this.requireSecret(credentials.consumerKey, "consumer key");
    this.requireSecret(credentials.consumerSecret, "consumer secret");
    await this.assertPublicHost(new URL(origin).hostname);
    const url = new URL(`/wp-json/wc/v3${path}`, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/wp-json/wc/v3/"))
      throw new WooCommerceApiError(
        "policy_blocked",
        "The WooCommerce request left its configured store boundary.",
        403,
      );
    const body = bodyObject ? JSON.stringify(bodyObject) : undefined;
    if (body && Buffer.byteLength(body) > 250_000)
      throw new WooCommerceApiError(
        "provider_validation_error",
        "WooCommerce request exceeds 250 KB.",
      );
    const authorization = Buffer.from(
      `${credentials.consumerKey}:${credentials.consumerSecret}`,
      "utf8",
    ).toString("base64");
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authorization}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 5_000_000)
        throw new WooCommerceApiError(
          "provider_validation_error",
          "WooCommerce response exceeds 5 MB.",
        );
      let data: unknown = raw.toString("utf8");
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        /* retain bounded text */
      }
      data = this.safe(data);
      if (!response.ok)
        throw new WooCommerceApiError(
          this.safeCode(response.status),
          this.errorMessage(data) ??
            `WooCommerce returned HTTP ${response.status}.`,
          response.status,
        );
      return { data, headers: response.headers };
    } catch (error) {
      if (error instanceof WooCommerceApiError) throw error;
      throw new WooCommerceApiError(
        "provider_unavailable",
        "WooCommerce could not be reached.",
        502,
      );
    }
  }

  private requireCredentials(credentials: WooCommerceCredentials) {
    this.storeOrigin(credentials.storeOrigin);
    this.requireSecret(credentials.consumerKey, "consumer key");
    this.requireSecret(credentials.consumerSecret, "consumer secret");
  }
  private storeOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new WooCommerceApiError(
        "provider_validation_error",
        "Enter a valid WooCommerce HTTPS store address.",
      );
    }
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "") ||
      !host ||
      host !== url.hostname.toLowerCase() ||
      this.blockedHostname(host)
    )
      throw new WooCommerceApiError(
        "policy_blocked",
        "WooCommerce V1 requires one exact public HTTPS store origin without a path.",
        403,
      );
    return `https://${host}`;
  }
  private async assertPublicHost(host: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new WooCommerceApiError(
        "provider_unavailable",
        "WooCommerce store DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new WooCommerceApiError(
        "policy_blocked",
        "WooCommerce store must resolve only to public addresses.",
        403,
      );
  }
  private blockedHostname(host: string) {
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      (isIP(host) > 0 && !this.publicAddress(host))
    );
  }
  private publicAddress(value: string) {
    if (isIP(value) === 4) {
      const [a, b] = value.split(".").map(Number);
      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
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
        normalized.startsWith("ff")
      );
    }
    return false;
  }
  private product(value: unknown) {
    const object = this.object(value);
    if (!object)
      throw new WooCommerceApiError(
        "provider_validation_error",
        "WooCommerce returned an invalid product.",
      );
    const keys = [
      "id",
      "name",
      "slug",
      "permalink",
      "status",
      "type",
      "description",
      "short_description",
      "sku",
      "price",
      "regular_price",
      "sale_price",
      "stock_status",
      "date_created",
      "date_created_gmt",
      "date_modified",
      "date_modified_gmt",
      "categories",
      "tags",
      "images",
      "attributes",
      "variations",
    ];
    return Object.fromEntries(keys.map((key) => [key, this.safe(object[key])]));
  }
  private errorMessage(value: unknown) {
    const object = this.object(value);
    const message = object?.message;
    return typeof message === "string" ? message.slice(0, 500) : null;
  }
  private headerInteger(headers: Headers, name: string) {
    const value = Number(headers.get(name) ?? 0);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
  private positiveId(value: unknown, label: string) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new WooCommerceApiError(
        "provider_validation_error",
        `WooCommerce ${label} must be a positive integer.`,
      );
    return id;
  }
  private ids(value: unknown, label: string) {
    if (!Array.isArray(value) || value.length > 30)
      throw new WooCommerceApiError(
        "provider_validation_error",
        `${label} must contain at most 30 IDs.`,
      );
    return [...new Set(value.map((item) => this.positiveId(item, label)))];
  }
  private timestamp(value: unknown) {
    const text = String(value ?? "");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(text) ||
      text.length > 40
    )
      throw new WooCommerceApiError(
        "provider_validation_error",
        "expectedDateModifiedGMT must be an exact WooCommerce GMT timestamp.",
      );
    return text;
  }
  private enumValue(value: unknown, allowed: string[]) {
    const selected = String(value ?? "");
    if (!allowed.includes(selected))
      throw new WooCommerceApiError(
        "provider_validation_error",
        "WooCommerce operation is invalid.",
      );
    return selected;
  }
  private integer(
    value: unknown,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const selected = Number(value ?? fallback);
    if (
      !Number.isSafeInteger(selected) ||
      selected < minimum ||
      selected > maximum
    )
      throw new WooCommerceApiError(
        "provider_validation_error",
        `Value must be an integer from ${minimum} to ${maximum}.`,
      );
    return selected;
  }
  private requiredText(value: unknown, maximum: number, label: string) {
    const text = String(value ?? "").trim();
    if (!text || text.length > maximum)
      throw new WooCommerceApiError(
        "provider_validation_error",
        `WooCommerce ${label} is required and must not exceed ${maximum} characters.`,
      );
    return text;
  }
  private optionalText(value: unknown, maximum: number, label: string) {
    const text = String(value ?? "").trim();
    if (text.length > maximum)
      throw new WooCommerceApiError(
        "provider_validation_error",
        `WooCommerce ${label} must not exceed ${maximum} characters.`,
      );
    return text;
  }
  private requireSecret(value: string, label: string) {
    if (!value || value.length > 8_000)
      throw new WooCommerceApiError(
        "credential_missing",
        `A valid WooCommerce ${label} is required.`,
        401,
      );
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 409) return "approval_mismatch";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private safe(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 20_000);
    if (Array.isArray(value))
      return value.slice(0, 50).map((item) => this.safe(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|consumer_key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.safe(item, depth + 1),
        ]),
    );
  }
}
