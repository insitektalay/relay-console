import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "magento_self_hosted_selected_product_stock_get",
    "Read selected product stock status",
    "Read only one selected public product SKU and its in-stock or out-of-stock status.",
  ),
];
const guards = [
  blocked(
    "magento_self_hosted_private_content",
    "Expose private commerce or product data",
    "Names, descriptions, prices, images, URLs, attributes, categories, reviews, inventory quantities, customer data, carts, orders, and private commerce data are excluded.",
  ),
  blocked(
    "magento_self_hosted_mutation",
    "Mutate Magento or Adobe Commerce",
    "Products, inventory, carts, checkout, orders, customers, configuration, extensions, content, users, files, and every other mutation are blocked.",
  ),
  blocked(
    "magento_self_hosted_broad_access",
    "Use broad commerce access",
    "Other products, search, lists, categories, arbitrary GraphQL, introspection, REST, SOAP, administration, authenticated access, redirects, and bulk access are blocked.",
  ),
];

export const MAGENTO_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "magento-self-hosted",
    name: "Magento Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.adobe.com/commerce/webapi/graphql/schema/products/queries/products/",
    providerWebsiteUrl:
      "https://business.adobe.com/products/commerce/magento/open-source.html",
    capabilities: [
      {
        ...capability(
          "magento_self_hosted_selected_product_stock_get",
          "Read selected product stock status",
          "Read bounded public stock status for one selected Magento product SKU.",
          true,
        ),
        platformCapability: "magento_self_hosted_selected_product_stock_get",
      },
    ],
    auth: {
      type: "custom",
      credentialSchema: [
        {
          name: "MAGENTO_SELF_HOSTED_BASE_URL",
          label: "Magento HTTPS commerce base URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact public HTTPS URL for one customer-owned Magento Open Source or on-premises Adobe Commerce installation, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
        },
        {
          name: "MAGENTO_SELF_HOSTED_PRODUCT_SKU",
          label: "Selected public product SKU",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact SKU of the single storefront-visible product Relay may inspect through the public core Commerce GraphQL API; V1 accepts only letters, numbers, dot, underscore, and hyphen.",
        },
      ],
    },
    tools: [
      {
        name: "magento-self-hosted.getSelectedProductStock",
        functionName: "magento_self_hosted_selected_product_stock_get",
        aliases: [
          "magento-self-hosted.getSelectedProductStock",
          "magento_self_hosted_selected_product_stock_get",
          "relay_magento_self_hosted_get_selected_product_stock",
        ],
        capability: "magento_self_hosted_selected_product_stock_get",
        platformCapability: "magento_self_hosted_selected_product_stock_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read only one selected public product SKU and its in-stock or out-of-stock status.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "magento_self_hosted_public_product_stock_read",
        label: "Public Product Stock Read",
        description:
          "Read one selected public product's stock status; product content, pricing, customers, carts, orders, administration, authenticated access, broader queries, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "magento_self_hosted_no_access",
        label: "No Access",
        description: "Expose no Magento Self-Hosted actions.",
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
        id: "selected_product_stock",
        label: "Magento public GraphQL and selected-product validation",
        requiredScopes: [],
      },
    ],
  };
