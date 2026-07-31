import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_MERCHANT_CENTER_SCOPES = [
  "https://www.googleapis.com/auth/content",
];
const reads = [
  action(
    "google_merchant_center_accounts_list",
    "List Merchant Center accounts",
    "Read the first fifty accessible Merchant Center accounts.",
  ),
  action(
    "google_merchant_center_products_list",
    "List Merchant Center products",
    "Read up to fifty processed products for the bound account.",
  ),
  action(
    "google_merchant_center_product_get",
    "Get Merchant Center product",
    "Read one explicit processed product from the bound account.",
  ),
  action(
    "google_merchant_center_product_issues_summary",
    "Review Merchant Center product issues",
    "Run Relay's fixed first-page product-issues report.",
  ),
];
const blockedActions = [
  blocked(
    "google_merchant_center_catalog_mutation",
    "Mutate catalog data",
    "Product, input, inventory, data source, promotion, review, and conversion writes are blocked.",
  ),
  blocked(
    "google_merchant_center_account_admin",
    "Administer Merchant Center",
    "Account, subaccount, user, service, shipping, return, registration, and quota administration is blocked.",
  ),
  blocked(
    "google_merchant_center_arbitrary_query_export",
    "Query or export Merchant data",
    "Arbitrary Merchant Query Language, filters, fields, tables, exports, page tokens, and automatic pagination are blocked.",
  ),
  blocked(
    "google_merchant_center_legacy_raw_access",
    "Use legacy or raw Merchant APIs",
    "Raw tools, service accounts, v1beta, Content API, batching, streaming, retries, and polling are blocked.",
  ),
];
const accountName = {
  type: "string",
  pattern: "^accounts/[0-9]+$",
  maxLength: 64,
};

export const GOOGLE_MERCHANT_CENTER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "google-merchant-center",
    name: "Google Merchant Center",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developers.google.com/merchant/api",
    providerWebsiteUrl: "https://merchants.google.com/",
    capabilities: [
      {
        ...capability(
          "accounts_list",
          "List accounts",
          "List at most fifty accessible accounts without pagination.",
          true,
        ),
        platformCapability: "google_merchant_center_accounts_list",
      },
      {
        ...capability(
          "products_list",
          "List processed products",
          "List at most fifty products for the bound account.",
          true,
        ),
        platformCapability: "google_merchant_center_products_list",
      },
      {
        ...capability(
          "product_get",
          "Read processed product",
          "Read one explicit processed product under the bound account.",
          true,
        ),
        platformCapability: "google_merchant_center_product_get",
      },
      {
        ...capability(
          "product_issues_summary",
          "Review product issues",
          "Run one fixed fifty-row product issue report.",
          true,
        ),
        platformCapability: "google_merchant_center_product_issues_summary",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        refreshUrl: "https://oauth2.googleapis.com/token",
        revocationUrl: "https://oauth2.googleapis.com/revoke",
        requiredScopes: GOOGLE_MERCHANT_CENTER_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "GOOGLE_OAUTH_CLIENT_ID",
          label: "Google OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Railway-held Relay Console confidential web OAuth client ID.",
        },
        {
          name: "GOOGLE_OAUTH_CLIENT_SECRET",
          label: "Google OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Railway-held Google OAuth client secret; never sent to clients or agents.",
        },
      ],
    },
    tools: [
      {
        name: "googleMerchantCenter.listAccounts",
        functionName: "google_merchant_center_accounts_list",
        aliases: ["google_merchant_center_accounts_list"],
        capability: "accounts_list",
        platformCapability: "google_merchant_center_accounts_list",
        action: "read",
        approvalRequired: false,
        description:
          "List the first fifty accessible Merchant Center accounts without pagination.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "googleMerchantCenter.listProducts",
        functionName: "google_merchant_center_products_list",
        aliases: ["google_merchant_center_products_list"],
        capability: "products_list",
        platformCapability: "google_merchant_center_products_list",
        action: "read",
        approvalRequired: false,
        description:
          "List up to fifty processed products for the exact account bound during OAuth.",
        inputSchema: {
          type: "object",
          properties: { accountName },
          additionalProperties: false,
        },
      },
      {
        name: "googleMerchantCenter.getProduct",
        functionName: "google_merchant_center_product_get",
        aliases: ["google_merchant_center_product_get"],
        capability: "product_get",
        platformCapability: "google_merchant_center_product_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read one explicit processed product under the bound account.",
        inputSchema: {
          type: "object",
          properties: {
            accountName,
            productName: {
              type: "string",
              pattern: "^accounts/[0-9]+/products/[^/?]+$",
              maxLength: 512,
            },
          },
          required: ["productName"],
          additionalProperties: false,
        },
      },
      {
        name: "googleMerchantCenter.reviewProductIssues",
        functionName: "google_merchant_center_product_issues_summary",
        aliases: ["google_merchant_center_product_issues_summary"],
        capability: "product_issues_summary",
        platformCapability: "google_merchant_center_product_issues_summary",
        action: "read",
        approvalRequired: false,
        description:
          "Run Relay's fixed fifty-row current-product issue report for the bound account.",
        inputSchema: {
          type: "object",
          properties: { accountName },
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "google_merchant_center_safe",
        label: "Safe",
        description:
          "Four stable-v1 bounded reads run automatically while all writes, administration, arbitrary queries, legacy APIs, and pagination remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The exact scope, selected account, fixed query, fifty-row cap, stable-v1, redaction, and no-write boundaries remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "stable-v1-bound-account",
        label: "Exact content scope and bound stable-v1 Merchant account",
        requiredScopes: GOOGLE_MERCHANT_CENTER_SCOPES,
      },
    ],
  };
