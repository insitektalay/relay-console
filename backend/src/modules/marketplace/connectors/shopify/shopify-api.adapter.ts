import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ShopifyCredentials = { shopDomain: string; accessToken: string };

export class ShopifyApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

const PRODUCT_FIELDS = "id title handle description descriptionHtml vendor productType status tags createdAt updatedAt seo { title description } options(first:25) { nodes { id name position optionValues { id name hasVariants } } } variants(first:25) { nodes { id title sku barcode availableForSale createdAt updatedAt } }";

@Injectable()
export class ShopifyApiAdapter {
  getShop(credentials: ShopifyCredentials) { return this.graph(credentials, "query RelayShop { shop { id name myshopifyDomain primaryDomain { host url } currencyCode plan { displayName } } }").then((data) => data.shop); }

  async listProducts(credentials: ShopifyCredentials, input: JsonObject = {}) {
    const first = this.integer(input.maxResults, 25, 1, 25);
    const after = this.optionalCursor(input.after);
    const data = await this.graph(credentials, `query RelayProducts($first:Int!,$after:String){ products(first:$first,after:$after,sortKey:UPDATED_AT,reverse:true){ nodes { ${PRODUCT_FIELDS} } pageInfo { hasNextPage endCursor } } }`, { first, after });
    return this.object(data.products) ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
  }

  async getProduct(credentials: ShopifyCredentials, input: JsonObject) {
    const data = await this.graph(credentials, `query RelayProduct($id:ID!){ product(id:$id){ ${PRODUCT_FIELDS} } }`, { id: this.gid(input.productId, "Product") });
    if (!data.product) throw new ShopifyApiError("provider_validation_error", "Shopify did not return the requested product.", 404);
    return data.product;
  }

  async listPublications(credentials: ShopifyCredentials) {
    const data = await this.graph(credentials, "query RelayPublications { publications(first:25){ nodes { id name autoPublish catalog { __typename title } } } }");
    return this.object(data.publications) ?? { nodes: [] };
  }

  prepareProductChange(credentials: ShopifyCredentials, input: JsonObject) {
    this.requireCredentials(credentials);
    const prepared = this.normalized(input);
    return { ...prepared, payloadHash: createHash("sha256").update(JSON.stringify(prepared)).digest("hex"), providerSideEffect: false };
  }

  async createDraftProduct(credentials: ShopifyCredentials, input: JsonObject) {
    const product = { ...this.editable(input), status: "DRAFT" };
    const data = await this.graph(credentials, "mutation RelayCreateDraft($product:ProductCreateInput!){ productCreate(product:$product){ product { id title handle status updatedAt } userErrors { field message code } } }", { product });
    return this.mutation(data, "productCreate");
  }

  async updateDraftProduct(credentials: ShopifyCredentials, input: JsonObject) {
    const id = this.gid(input.productId, "Product");
    await this.assertState(credentials, id, input.expectedUpdatedAt, "DRAFT");
    const data = await this.graph(credentials, "mutation RelayUpdateDraft($product:ProductUpdateInput!){ productUpdate(product:$product){ product { id title handle status updatedAt } userErrors { field message code } } }", { product: { id, ...this.editable(input) } });
    return this.mutation(data, "productUpdate");
  }

  async activateProduct(credentials: ShopifyCredentials, input: JsonObject) {
    const id = this.gid(input.productId, "Product");
    await this.assertState(credentials, id, input.expectedUpdatedAt, "DRAFT");
    const data = await this.graph(credentials, "mutation RelayActivate($product:ProductUpdateInput!){ productUpdate(product:$product){ product { id title handle status updatedAt } userErrors { field message code } } }", { product: { id, status: "ACTIVE" } });
    return this.mutation(data, "productUpdate");
  }

  async publishProduct(credentials: ShopifyCredentials, input: JsonObject) {
    const id = this.gid(input.productId, "Product");
    const publicationId = this.gid(input.publicationId, "Publication");
    await this.assertState(credentials, id, input.expectedUpdatedAt, "ACTIVE");
    const data = await this.graph(credentials, "mutation RelayPublish($id:ID!,$input:[PublicationInput!]!){ publishablePublish(id:$id,input:$input){ publishable { availablePublicationsCount { count } resourcePublicationsCount { count } } userErrors { field message code } } }", { id, input: [{ publicationId }] });
    return this.mutation(data, "publishablePublish");
  }

  private normalized(input: JsonObject) {
    const operation = this.enumValue(input.operation, ["create", "update", "activate", "publish"]);
    if (operation === "create") return { operation, ...this.editable(input) };
    const productId = this.gid(input.productId, "Product");
    const expectedUpdatedAt = this.timestamp(input.expectedUpdatedAt);
    if (operation === "update") return { operation, productId, expectedUpdatedAt, ...this.editable(input) };
    if (operation === "activate") return { operation, productId, expectedUpdatedAt };
    return { operation, productId, publicationId: this.gid(input.publicationId, "Publication"), expectedUpdatedAt };
  }

  private async assertState(credentials: ShopifyCredentials, productId: string, expectedUpdatedAt: unknown, expectedStatus: "DRAFT" | "ACTIVE") {
    const expected = this.timestamp(expectedUpdatedAt);
    const data = await this.graph(credentials, "query RelayProductState($id:ID!){ product(id:$id){ id status updatedAt } }", { id: productId });
    const product = this.object(data.product);
    if (!product) throw new ShopifyApiError("provider_validation_error", "Shopify did not return the requested product.", 404);
    if (product.status !== expectedStatus) throw new ShopifyApiError("policy_blocked", `Shopify product must be ${expectedStatus.toLowerCase()} for this operation.`, 403);
    if (product.updatedAt !== expected) throw new ShopifyApiError("approval_mismatch", "The Shopify product changed after it was reviewed; reload it before retrying.", 409);
  }

  private async graph(credentials: ShopifyCredentials, query: string, variables: JsonObject = {}) {
    const shop = this.shopDomain(credentials.shopDomain);
    this.requireToken(credentials.accessToken);
    const body = JSON.stringify({ query, variables });
    if (Buffer.byteLength(body) > 250_000) throw new ShopifyApiError("provider_validation_error", "Shopify request exceeds 250 KB.");
    try {
      const response = await safeConnectorFetch(`https://${shop}/admin/api/2026-07/graphql.json`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-Shopify-Access-Token": credentials.accessToken }, body, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 5_000_000) throw new ShopifyApiError("provider_validation_error", "Shopify response exceeds 5 MB.");
      let decoded: unknown;
      try { decoded = raw.length ? JSON.parse(raw.toString("utf8")) : null; } catch { decoded = null; }
      if (!response.ok) throw new ShopifyApiError(this.safeCode(response.status), `Shopify returned HTTP ${response.status}.`, response.status);
      const envelope = this.object(decoded);
      const errors = Array.isArray(envelope?.errors) ? envelope.errors : [];
      if (errors.length) throw new ShopifyApiError("graph_error", this.providerMessage(errors[0]) ?? "Shopify returned a GraphQL error.", 422);
      return this.object(envelope?.data) ?? {};
    } catch (error) {
      if (error instanceof ShopifyApiError) throw error;
      throw new ShopifyApiError("provider_unavailable", "Shopify could not be reached.", 502);
    }
  }

  private mutation(data: JsonObject, key: string) {
    const root = this.object(data[key]);
    const errors = Array.isArray(root?.userErrors) ? root.userErrors : [];
    if (errors.length) throw new ShopifyApiError("provider_validation_error", this.providerMessage(errors[0]) ?? "Shopify rejected the change.", 422);
    return this.redact(root ?? {});
  }

  private editable(input: JsonObject) {
    const output: JsonObject = {};
    if (input.title !== undefined) output.title = this.requiredText(input.title, 255, "title");
    for (const [key, maximum] of [["descriptionHtml", 100_000], ["vendor", 255], ["productType", 255]] as const) if (input[key] !== undefined) output[key] = this.optionalText(input[key], maximum, key);
    if (input.handle !== undefined) { const handle = this.optionalText(input.handle, 255, "handle"); if (handle && !/^[a-z0-9-]+$/.test(handle)) throw new ShopifyApiError("provider_validation_error", "Shopify handle must contain lowercase letters, numbers, and hyphens only."); output.handle = handle; }
    if (input.tags !== undefined) { if (!Array.isArray(input.tags) || input.tags.length > 50) throw new ShopifyApiError("provider_validation_error", "Shopify tags must contain at most 50 values."); output.tags = [...new Set(input.tags.map((tag) => this.requiredText(tag, 255, "tag")))]; }
    if (!Object.keys(output).length) throw new ShopifyApiError("provider_validation_error", "At least one editable Shopify product field is required.");
    return output;
  }

  private requireCredentials(credentials: ShopifyCredentials) { this.shopDomain(credentials.shopDomain); this.requireToken(credentials.accessToken); }
  private requireToken(value: string) { if (!value || value.length > 8_000) throw new ShopifyApiError("credential_missing", "A valid Shopify connection is required.", 401); }
  private shopDomain(value: string) { const host = String(value ?? ""); if (host !== host.toLowerCase() || !/^[a-z0-9][a-z0-9-]{0,61}\.myshopify\.com$/.test(host)) throw new ShopifyApiError("policy_blocked", "Shopify V1 requires the exact lowercase myshopify.com shop domain.", 403); return host; }
  private gid(value: unknown, resource: "Product" | "Publication") { const id = String(value ?? ""); if (!new RegExp(`^gid://shopify/${resource}/[A-Za-z0-9_-]+$`).test(id) || id.length > 200) throw new ShopifyApiError("provider_validation_error", `A valid Shopify ${resource} GID is required.`); return id; }
  private timestamp(value: unknown) { const text = String(value ?? ""); const date = new Date(text); if (text.length > 40 || Number.isNaN(date.getTime()) || date.toISOString() !== text) throw new ShopifyApiError("provider_validation_error", "expectedUpdatedAt must be an exact ISO-8601 UTC timestamp."); return text; }
  private optionalCursor(value: unknown) { if (value === undefined || value === null || value === "") return null; return this.requiredText(value, 500, "cursor"); }
  private enumValue(value: unknown, allowed: string[]) { const selected = String(value ?? ""); if (!allowed.includes(selected)) throw new ShopifyApiError("provider_validation_error", "Shopify operation is invalid."); return selected; }
  private integer(value: unknown, fallback: number, minimum: number, maximum: number) { const selected = Number(value ?? fallback); if (!Number.isSafeInteger(selected) || selected < minimum || selected > maximum) throw new ShopifyApiError("provider_validation_error", `Value must be an integer from ${minimum} to ${maximum}.`); return selected; }
  private requiredText(value: unknown, maximum: number, label: string) { const text = String(value ?? "").trim(); if (!text || text.length > maximum) throw new ShopifyApiError("provider_validation_error", `Shopify ${label} is required and must not exceed ${maximum} characters.`); return text; }
  private optionalText(value: unknown, maximum: number, label: string) { const text = String(value ?? "").trim(); if (text.length > maximum) throw new ShopifyApiError("provider_validation_error", `Shopify ${label} must not exceed ${maximum} characters.`); return text; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private providerMessage(value: unknown) { const object = this.object(value); return typeof object?.message === "string" ? object.message.slice(0, 500) : null; }
  private object(value: unknown): JsonObject | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
  private redact(value: unknown, depth = 0): unknown { if (depth > 12) return "[truncated]"; if (typeof value === "string") return value.slice(0, 1_000_000); if (Array.isArray(value)) return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 1_000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
}
