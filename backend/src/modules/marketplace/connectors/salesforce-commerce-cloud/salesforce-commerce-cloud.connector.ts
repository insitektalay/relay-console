import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const SALESFORCE_COMMERCE_CLOUD_SCOPES = [
  "sfcc.shopper-products",
  "sfcc.shopper-categories",
];
const reads = [
  action(
    "salesforce_commerce_cloud_product_summary_get",
    "Read selected product",
    "Read public storefront metadata for one preselected product.",
  ),
  action(
    "salesforce_commerce_cloud_category_summary_get",
    "Read selected category",
    "Read public storefront metadata for one preselected category.",
  ),
];
const guards = [
  blocked(
    "salesforce_commerce_cloud_private_data",
    "Expose private commerce data",
    "Customers, guest identifiers, tokens, baskets, orders, addresses, payments, inventory, promotions, prices, content, images, descriptions, variants, custom fields, and raw responses are excluded.",
  ),
  blocked(
    "salesforce_commerce_cloud_mutation",
    "Mutate Commerce Cloud state",
    "Baskets, checkout, orders, customers, wishlists, promotions, catalogs, products, inventory, content, configuration, jobs, imports, and administration are blocked.",
  ),
  blocked(
    "salesforce_commerce_cloud_broad_access",
    "Use broad Commerce Cloud access",
    "Other organizations, sites, products, categories, scopes, Admin APIs, Account Manager, OCAPI, SOAP, search, paging, arbitrary paths, redirects, downloads, and exports are blocked.",
  ),
];

export const SALESFORCE_COMMERCE_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "salesforce-commerce-cloud",
    name: "Salesforce Commerce Cloud",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.salesforce.com/docs/commerce/commerce-api/guide/authorization-for-shopper-apis.html",
    providerWebsiteUrl: "https://www.salesforce.com/commerce/",
    capabilities: [
      {
        ...capability(
          "salesforce_commerce_cloud_product_summary_get",
          "Read selected product",
          "Read a bounded public storefront summary for one selected product.",
          true,
        ),
        platformCapability: "salesforce_commerce_cloud_product_summary_get",
      },
      {
        ...capability(
          "salesforce_commerce_cloud_category_summary_get",
          "Read selected category",
          "Read a bounded public storefront summary for one selected category.",
          true,
        ),
        platformCapability: "salesforce_commerce_cloud_category_summary_get",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "SALESFORCE_COMMERCE_CLOUD_SHORT_CODE",
          label: "B2C Commerce short code",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The exact instance short code used to construct the trusted SCAPI host.",
        },
        {
          name: "SALESFORCE_COMMERCE_CLOUD_ORGANIZATION_ID",
          label: "B2C Commerce organization ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The exact organization ID whose selected storefront resources Relay may read.",
        },
        {
          name: "SALESFORCE_COMMERCE_CLOUD_SITE_ID",
          label: "Selected storefront site ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The exact site/channel ID bound into the guest SLAS token and both Shopper API calls.",
        },
        {
          name: "SALESFORCE_COMMERCE_CLOUD_CLIENT_ID",
          label: "Private SLAS client ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "A dedicated customer-owned private SLAS client configured with exactly the two required read scopes.",
        },
        {
          name: "SALESFORCE_COMMERCE_CLOUD_CLIENT_SECRET",
          label: "Private SLAS client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Relay encrypts this customer secret and uses HTTP Basic authentication only at the exact guest token endpoint.",
        },
        {
          name: "SALESFORCE_COMMERCE_CLOUD_PRODUCT_ID",
          label: "Selected product ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The one storefront product whose bounded public metadata Relay may read.",
        },
        {
          name: "SALESFORCE_COMMERCE_CLOUD_CATEGORY_ID",
          label: "Selected category ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The one storefront category whose bounded public metadata Relay may read.",
        },
      ],
    },
    tools: [
      {
        name: "salesforce-commerce-cloud.getProductSummary",
        functionName: "salesforce_commerce_cloud_product_summary_get",
        aliases: [
          "salesforce-commerce-cloud.getProductSummary",
          "salesforce_commerce_cloud_product_summary_get",
          "relay_salesforce_commerce_cloud_get_product_summary",
        ],
        capability: "salesforce_commerce_cloud_product_summary_get",
        platformCapability: "salesforce_commerce_cloud_product_summary_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded public storefront metadata for the preselected product.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "salesforce-commerce-cloud.getCategorySummary",
        functionName: "salesforce_commerce_cloud_category_summary_get",
        aliases: [
          "salesforce-commerce-cloud.getCategorySummary",
          "salesforce_commerce_cloud_category_summary_get",
          "relay_salesforce_commerce_cloud_get_category_summary",
        ],
        capability: "salesforce_commerce_cloud_category_summary_get",
        platformCapability: "salesforce_commerce_cloud_category_summary_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded public storefront metadata for the preselected category.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "salesforce_commerce_cloud_read_only",
        label: "Read Only",
        description:
          "Read one selected product and category with an exact two-scope site-bound token; private data and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "salesforce_commerce_cloud_no_access",
        label: "No Access",
        description: "Expose no Salesforce Commerce Cloud actions.",
        defaultSelected: false,
        allowedActions: [],
        approvalRequiredActions: [],
        blockedActions: [
          ...reads.map((item) =>
            blocked(item.id, item.label, "Blocked by authority preset."),
          ),
          ...guards,
        ],
      },
    ],
    healthChecks: [
      {
        id: "selected_product",
        label:
          "Commerce Cloud credentials, organization, site, scopes, and selected product validation",
        requiredScopes: SALESFORCE_COMMERCE_CLOUD_SCOPES,
      },
    ],
  };
