import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const SHOPIFY_SCOPES = ["write_products", "write_publications"];

const reads = [
  action("shopify_shop_get", "Read shop", "Read safe identity, domain, currency, and plan metadata for the connected shop."),
  action("shopify_product_list", "List products", "Read one bounded cursor page of useful product catalogue metadata."),
  action("shopify_product_get", "Read product", "Read one explicit product with status, SEO, options, and bounded variants."),
  action("shopify_publication_list", "List publications", "Read bounded publication identifiers for explicit product publication."),
  action("shopify_product_prepare", "Prepare product change", "Normalize and hash a proposed product change locally."),
];
const writes = [
  action("shopify_product_create_draft", "Create draft product", "Create one reviewed product forced to draft status."),
  action("shopify_product_update_draft", "Update draft product", "Update reviewed fields after an exact draft-state preflight."),
  action("shopify_product_activate", "Activate product", "Activate one exact reviewed draft without publishing it."),
  action("shopify_product_publish", "Publish product", "Publish one exact reviewed active product to one explicit publication."),
];
const blockedActions = [
  blocked("shopify_product_destructive", "Delete, archive, or unpublish products", "Destructive product lifecycle operations are outside V1."),
  blocked("shopify_commerce_admin", "Administer commerce operations", "Orders, customers, payments, fulfilment, inventory and pricing writes, variants, discounts, files, themes, billing, and administration are outside V1."),
  blocked("shopify_raw_graphql", "Use arbitrary Shopify APIs", "Arbitrary GraphQL, bulk operations, automatic pagination, and cross-shop access are outside V1."),
];
const gid = (resource: "Product" | "Publication") => ({ type: "string", minLength: 24, maxLength: 200, pattern: `^gid://shopify/${resource}/[A-Za-z0-9_-]+$` });
const timestamp = () => ({ type: "string", minLength: 20, maxLength: 40, format: "date-time" });
const text = (maximum: number) => ({ type: "string", maxLength: maximum });
const tags = () => ({ type: "array", maxItems: 50, items: text(255) });
const editable = { title: { type: "string", minLength: 1, maxLength: 255 }, descriptionHtml: text(100_000), vendor: text(255), productType: text(255), handle: { type: "string", maxLength: 255, pattern: "^[a-z0-9-]+$" }, tags: tags() };
const write = (properties: Record<string, unknown>) => ({ ...properties, approvalId: { type: "string", minLength: 1, maxLength: 200 }, idempotencyKey: { type: "string", minLength: 1, maxLength: 200 } });
const tool = (name: string, functionName: string, cap: string, actionName: "read" | "draft" | "write", approvalRequired: boolean, description: string, properties: Record<string, unknown>, required: string[] = []) => ({ name, functionName, aliases: [name, functionName], capability: cap, platformCapability: `shopify_${cap}`, action: actionName, approvalRequired, description, inputSchema: { type: "object", properties, required, additionalProperties: false } });

export const SHOPIFY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "shopify", name: "Shopify", connectorType: "native_clawchat",
  providerDocsUrl: "https://shopify.dev/docs/api/admin-graphql/2026-07", providerWebsiteUrl: "https://www.shopify.com/",
  capabilities: [
    { ...capability("shop_read", "Read shop", "Read bounded identity and account details for the connected shop.", true), platformCapability: "shopify_shop_read" },
    { ...capability("product_read", "Read products", "Read bounded product and publication data.", true), platformCapability: "shopify_product_read" },
    { ...capability("product_draft", "Prepare and edit drafts", "Prepare changes and create or update draft products.", true), platformCapability: "shopify_product_draft" },
    { ...capability("product_publish", "Activate and publish products", "Activate a draft and publish an active product to one publication.", true), platformCapability: "shopify_product_publish" },
  ],
  auth: { type: "oauth2_authorization_code", oauth: { authorizationUrl: "https://{shop}.myshopify.com/admin/oauth/authorize", tokenUrl: "https://{shop}.myshopify.com/admin/oauth/access_token", refreshUrl: "https://{shop}.myshopify.com/admin/oauth/access_token", requiredScopes: SHOPIFY_SCOPES, optionalScopes: [], pkce: false, supportsRefresh: true }, credentialSchema: [
    { name: "SHOPIFY_SHOP_DOMAIN", label: "Shopify shop domain", required: true, secret: false, storedIn: "metadata", helpText: "Enter the exact lowercase myshopify.com domain for the shop, such as acme.myshopify.com." },
    { name: "SHOPIFY_CLIENT_ID", label: "Shopify client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay Console Shopify app client ID." },
    { name: "SHOPIFY_CLIENT_SECRET", label: "Shopify client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay Console Shopify app client secret; never sent to clients or agents." },
  ] },
  tools: [
    tool("shopify.getShop", "shopify_shop_get", "shop_read", "read", false, "Read safe metadata for the connected shop.", {}),
    tool("shopify.listProducts", "shopify_product_list", "product_read", "read", false, "Read one bounded product cursor page.", { maxResults: { type: "integer", minimum: 1, maximum: 25 }, after: text(500) }),
    tool("shopify.getProduct", "shopify_product_get", "product_read", "read", false, "Read one explicit product.", { productId: gid("Product") }, ["productId"]),
    tool("shopify.listPublications", "shopify_publication_list", "product_read", "read", false, "Read up to twenty-five publications.", {}),
    tool("shopify.prepareProductChange", "shopify_product_prepare", "product_draft", "draft", false, "Normalize and hash one product change locally.", { operation: { type: "string", enum: ["create", "update", "activate", "publish"] }, productId: gid("Product"), publicationId: gid("Publication"), expectedUpdatedAt: timestamp(), ...editable }, ["operation"]),
    tool("shopify.createDraftProduct", "shopify_product_create_draft", "product_draft", "write", true, "Create one product forced to draft status.", write(editable), ["title", "approvalId", "idempotencyKey"]),
    tool("shopify.updateDraftProduct", "shopify_product_update_draft", "product_draft", "write", true, "Update one exact reviewed draft product.", write({ productId: gid("Product"), expectedUpdatedAt: timestamp(), ...editable }), ["productId", "expectedUpdatedAt", "title", "approvalId", "idempotencyKey"]),
    tool("shopify.activateProduct", "shopify_product_activate", "product_publish", "write", true, "Activate one exact reviewed draft product.", write({ productId: gid("Product"), expectedUpdatedAt: timestamp() }), ["productId", "expectedUpdatedAt", "approvalId", "idempotencyKey"]),
    tool("shopify.publishProduct", "shopify_product_publish", "product_publish", "write", true, "Publish one exact reviewed active product to one publication.", write({ productId: gid("Product"), publicationId: gid("Publication"), expectedUpdatedAt: timestamp() }), ["productId", "publicationId", "expectedUpdatedAt", "approvalId", "idempotencyKey"]),
  ],
  approvalProfiles: [
    { id: "shopify_safe", label: "Safe", description: "Bounded reads and local preparation run directly; draft creation, draft updates, activation, and publication require matching approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected Shopify V1 operation runs without Relay per-action approval; connection ownership, exact shop binding, granted scopes, bounds, state checks, audits, redaction, idempotency, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "shop", label: "Shopify shop authorization and required-scope validation", requiredScopes: SHOPIFY_SCOPES }],
};
