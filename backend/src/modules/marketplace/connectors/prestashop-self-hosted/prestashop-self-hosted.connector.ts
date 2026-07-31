import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "prestashop_self_hosted_selected_product_availability_get",
    "Read selected product availability",
    "Read only one selected product ID plus its active and available-for-order flags.",
  ),
];
const guards = [
  blocked(
    "prestashop_self_hosted_private_content",
    "Expose private shop or product data",
    "Names, references, descriptions, prices, images, taxonomy, inventory quantities, suppliers, customer data, carts, orders, and private shop data are excluded.",
  ),
  blocked(
    "prestashop_self_hosted_mutation",
    "Mutate PrestaShop",
    "Products, stock, carts, checkout, orders, customers, configuration, modules, content, users, files, and every other mutation are blocked.",
  ),
  blocked(
    "prestashop_self_hosted_broad_access",
    "Use broad Webservice access",
    "Other products, unfiltered lists, arbitrary filters or fields, other resources, schemas, search, administration, redirects, and bulk access are blocked.",
  ),
];

export const PRESTASHOP_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "prestashop-self-hosted",
    name: "PrestaShop Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://devdocs.prestashop-project.org/9/webservice/getting-started/",
    providerWebsiteUrl: "https://prestashop-project.org/",
    capabilities: [
      {
        ...capability(
          "prestashop_self_hosted_selected_product_availability_get",
          "Read selected product availability",
          "Read bounded availability flags for one selected PrestaShop product.",
          true,
        ),
        platformCapability:
          "prestashop_self_hosted_selected_product_availability_get",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "PRESTASHOP_SELF_HOSTED_BASE_URL",
          label: "PrestaShop HTTPS shop base URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact public HTTPS URL for one customer-owned PrestaShop installation, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
        },
        {
          name: "PRESTASHOP_SELF_HOSTED_WEBSERVICE_KEY",
          label: "Dedicated products-view Webservice key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "A dedicated 32-character PrestaShop Webservice key associated only with the required shop and granted View permission for products; no modify, add, delete, or other resource permissions.",
        },
        {
          name: "PRESTASHOP_SELF_HOSTED_PRODUCT_ID",
          label: "Selected product ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact positive numeric ID of the single product Relay may query through a fixed id filter and field projection.",
        },
      ],
    },
    tools: [
      {
        name: "prestashop-self-hosted.getSelectedProductAvailability",
        functionName:
          "prestashop_self_hosted_selected_product_availability_get",
        aliases: [
          "prestashop-self-hosted.getSelectedProductAvailability",
          "prestashop_self_hosted_selected_product_availability_get",
          "relay_prestashop_self_hosted_get_selected_product_availability",
        ],
        capability: "prestashop_self_hosted_selected_product_availability_get",
        platformCapability:
          "prestashop_self_hosted_selected_product_availability_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read only one selected product ID plus its active and available-for-order flags.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "prestashop_self_hosted_selected_product_read",
        label: "Selected Product Read",
        description:
          "Read one selected product's availability flags; content, pricing, inventory quantities, customers, carts, orders, other resources, administration, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "prestashop_self_hosted_no_access",
        label: "No Access",
        description: "Expose no PrestaShop Self-Hosted actions.",
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
        label: "PrestaShop Webservice and selected-product validation",
        requiredScopes: ["products:GET"],
      },
    ],
  };
