import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "woocommerce_product_list",
    "List products",
    "Read one bounded page of recently modified products.",
  ),
  action(
    "woocommerce_product_get",
    "Read product",
    "Read one explicit product and bounded related metadata.",
  ),
  action(
    "woocommerce_category_list",
    "List product categories",
    "Read up to twenty-five product categories.",
  ),
  action(
    "woocommerce_product_prepare",
    "Prepare product change",
    "Normalize and hash one proposed product change locally.",
  ),
];
const writes = [
  action(
    "woocommerce_product_create_draft",
    "Create draft product",
    "Create one reviewed product forced to draft status.",
  ),
  action(
    "woocommerce_product_update_draft",
    "Update draft product",
    "Update one reviewed draft after an exact modification-time preflight.",
  ),
  action(
    "woocommerce_product_publish",
    "Publish product",
    "Publish one exact reviewed draft after an exact modification-time preflight.",
  ),
];
const blockedActions = [
  blocked(
    "woocommerce_product_destructive",
    "Delete or unpublish products",
    "Deletion, force deletion, trashing, and unpublishing are outside V1.",
  ),
  blocked(
    "woocommerce_commerce_admin",
    "Administer store operations",
    "Orders, customers, payments, refunds, inventory writes, coupons, shipping, taxes, reports, webhooks, settings, and extensions are outside V1.",
  ),
  blocked(
    "woocommerce_raw_rest",
    "Use arbitrary WooCommerce APIs",
    "Arbitrary REST routes, query-string credential fallback, batch endpoints, and automatic pagination are outside V1.",
  ),
];
const id = () => ({
  type: "integer",
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});
const timestamp = () => ({ type: "string", minLength: 19, maxLength: 40 });
const text = (maximum: number) => ({ type: "string", maxLength: maximum });
const ids = () => ({
  type: "array",
  maxItems: 30,
  uniqueItems: true,
  items: id(),
});
const editable = {
  name: { type: "string", minLength: 1, maxLength: 255 },
  slug: { type: "string", maxLength: 255, pattern: "^[a-z0-9-]*$" },
  description: text(20_000),
  shortDescription: text(20_000),
  categoryIds: ids(),
  tagIds: ids(),
};
const write = (properties: Record<string, unknown>) => ({
  ...properties,
  approvalId: { type: "string", minLength: 1, maxLength: 200 },
  idempotencyKey: { type: "string", minLength: 1, maxLength: 200 },
});
const tool = (
  name: string,
  functionName: string,
  cap: string,
  actionName: "read" | "draft" | "write",
  approvalRequired: boolean,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: cap,
  platformCapability: `woocommerce_${cap}`,
  action: actionName,
  approvalRequired,
  description,
  inputSchema: {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  },
});

export const WOOCOMMERCE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "woocommerce",
  name: "WooCommerce",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.woocommerce.com/docs/apis/rest-api/v3/",
  providerWebsiteUrl: "https://woocommerce.com/",
  capabilities: [
    {
      ...capability(
        "product_read",
        "Read products",
        "List and inspect bounded product and category data.",
        true,
      ),
      platformCapability: "woocommerce_product_read",
    },
    {
      ...capability(
        "product_draft",
        "Prepare and edit drafts",
        "Prepare product changes and create or update draft products.",
        true,
      ),
      platformCapability: "woocommerce_product_draft",
    },
    {
      ...capability(
        "product_publish",
        "Publish reviewed drafts",
        "Publish one exact reviewed draft after a modification-time check.",
        true,
      ),
      platformCapability: "woocommerce_product_publish",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "WOOCOMMERCE_STORE_ORIGIN",
        label: "Store address",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter the exact public HTTPS store origin without a path.",
      },
      {
        name: "WOOCOMMERCE_CONSUMER_KEY",
        label: "Consumer key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated read/write WooCommerce REST API consumer key.",
      },
      {
        name: "WOOCOMMERCE_CONSUMER_SECRET",
        label: "Consumer secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the matching consumer secret; Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    tool(
      "woocommerce.listProducts",
      "woocommerce_product_list",
      "product_read",
      "read",
      false,
      "Read one bounded page of recently modified products.",
      {
        page: { type: "integer", minimum: 1, maximum: 10_000 },
        maxResults: { type: "integer", minimum: 1, maximum: 25 },
      },
    ),
    tool(
      "woocommerce.getProduct",
      "woocommerce_product_get",
      "product_read",
      "read",
      false,
      "Read one explicit product.",
      { productId: id() },
      ["productId"],
    ),
    tool(
      "woocommerce.listCategories",
      "woocommerce_category_list",
      "product_read",
      "read",
      false,
      "Read up to twenty-five product categories.",
      {},
    ),
    tool(
      "woocommerce.prepareProductChange",
      "woocommerce_product_prepare",
      "product_draft",
      "draft",
      false,
      "Normalize and hash one product change locally.",
      {
        operation: { type: "string", enum: ["create", "update", "publish"] },
        productId: id(),
        expectedDateModifiedGMT: timestamp(),
        ...editable,
      },
      ["operation"],
    ),
    tool(
      "woocommerce.createDraftProduct",
      "woocommerce_product_create_draft",
      "product_draft",
      "write",
      true,
      "Create one product forced to draft status.",
      write(editable),
      ["name", "approvalId", "idempotencyKey"],
    ),
    tool(
      "woocommerce.updateDraftProduct",
      "woocommerce_product_update_draft",
      "product_draft",
      "write",
      true,
      "Update one exact reviewed draft.",
      write({
        productId: id(),
        expectedDateModifiedGMT: timestamp(),
        ...editable,
      }),
      [
        "productId",
        "expectedDateModifiedGMT",
        "name",
        "approvalId",
        "idempotencyKey",
      ],
    ),
    tool(
      "woocommerce.publishProduct",
      "woocommerce_product_publish",
      "product_publish",
      "write",
      true,
      "Publish one exact reviewed draft.",
      write({ productId: id(), expectedDateModifiedGMT: timestamp() }),
      ["productId", "expectedDateModifiedGMT", "approvalId", "idempotencyKey"],
    ),
  ],
  approvalProfiles: [
    {
      id: "woocommerce_safe",
      label: "Safe",
      description:
        "Bounded reads and local preparation run directly; draft creation, draft updates, and publication require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected WooCommerce V1 operation runs without Relay per-action approval; connection ownership, exact store binding, provider key authority, public-address checks, bounds, state checks, audits, redaction, idempotency, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "system-status",
      label: "WooCommerce store origin and REST API key validation",
    },
  ],
};
