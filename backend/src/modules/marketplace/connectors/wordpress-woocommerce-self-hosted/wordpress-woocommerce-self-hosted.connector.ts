import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "wordpress_woocommerce_self_hosted_selected_product_availability_get",
    "Read selected product availability",
    "Read only one selected public product's ID and purchasable, in-stock, and on-sale flags.",
  ),
];
const guards = [
  blocked(
    "wordpress_woocommerce_self_hosted_private_content",
    "Expose private store or product content",
    "Names, slugs, SKUs, descriptions, prices, images, categories, attributes, ratings, links, cart details, customer data, orders, and private store data are excluded.",
  ),
  blocked(
    "wordpress_woocommerce_self_hosted_mutation",
    "Mutate WooCommerce or WordPress",
    "Cart, checkout, orders, customers, products, coupons, settings, plugins, themes, content, users, files, and every other mutation are blocked.",
  ),
  blocked(
    "wordpress_woocommerce_self_hosted_broad_access",
    "Use broad store access",
    "Other products, lists, search, filters, collections, categories, reviews, carts, checkout, orders, arbitrary paths or queries, redirects, and bulk access are blocked.",
  ),
];

export const WORDPRESS_WOOCOMMERCE_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "wordpress-woocommerce-self-hosted",
    name: "WordPress WooCommerce Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/products/",
    providerWebsiteUrl: "https://woocommerce.com/",
    capabilities: [
      {
        ...capability(
          "wordpress_woocommerce_self_hosted_selected_product_availability_get",
          "Read selected product availability",
          "Read bounded public availability flags for one selected WooCommerce product.",
          true,
        ),
        platformCapability:
          "wordpress_woocommerce_self_hosted_selected_product_availability_get",
      },
    ],
    auth: {
      type: "custom",
      credentialSchema: [
        {
          name: "WORDPRESS_WOOCOMMERCE_STORE_BASE_URL",
          label: "WooCommerce HTTPS store base URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact public HTTPS URL for one customer-owned WordPress store, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
        },
        {
          name: "WORDPRESS_WOOCOMMERCE_PRODUCT_ID",
          label: "Selected public product ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact positive numeric ID of the single published product Relay may inspect through the public Store API.",
        },
      ],
    },
    tools: [
      {
        name: "wordpress-woocommerce-self-hosted.getSelectedProductAvailability",
        functionName:
          "wordpress_woocommerce_self_hosted_selected_product_availability_get",
        aliases: [
          "wordpress-woocommerce-self-hosted.getSelectedProductAvailability",
          "wordpress_woocommerce_self_hosted_selected_product_availability_get",
          "relay_wordpress_woocommerce_get_selected_product_availability",
        ],
        capability:
          "wordpress_woocommerce_self_hosted_selected_product_availability_get",
        platformCapability:
          "wordpress_woocommerce_self_hosted_selected_product_availability_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read only one selected public product's ID and purchasable, in-stock, and on-sale flags.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "wordpress_woocommerce_self_hosted_public_product_read",
        label: "Public Product Read",
        description:
          "Read one selected public product's availability flags; content, pricing, customers, orders, carts, broader access, administration, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "wordpress_woocommerce_self_hosted_no_access",
        label: "No Access",
        description: "Expose no WordPress WooCommerce Self-Hosted actions.",
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
        label: "WooCommerce public Store API and selected-product validation",
        requiredScopes: [],
      },
    ],
  };
