import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "ironclad_clickwrap_site_get",
    "Read the connected site",
    "Read a privacy-reduced summary of the exact configured Ironclad Clickwrap Site.",
  ),
  action(
    "ironclad_clickwrap_contract_list",
    "List contracts",
    "List at most twenty-five privacy-reduced Contract summaries from page one of the exact configured Site.",
  ),
  action(
    "ironclad_clickwrap_group_list",
    "List groups",
    "List at most twenty-five privacy-reduced Clickwrap Group summaries from page one of the exact configured Site.",
  ),
];

export const IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "ironclad-clickwrap",
    name: "Ironclad Clickwrap",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://clickwrap-developer.ironcladapp.com/docs/getting-your-access-token",
    providerWebsiteUrl: "https://ironcladapp.com/products/clickwrap/",
    capabilities: [
      {
        ...capability(
          "clickwrap_configuration_read",
          "Read Clickwrap configuration",
          "Read bounded Site, Contract and Group configuration summaries from one exact Ironclad Clickwrap Site.",
          true,
        ),
        platformCapability: "ironclad_clickwrap_configuration_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "IRONCLAD_CLICKWRAP_ACCESS_TOKEN",
          label: "Clickwrap access token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Create a dedicated API application in the Ironclad Clickwrap user profile. Relay encrypts its user-bound bearer token and sends it only to api.pactsafe.com.",
        },
        {
          name: "IRONCLAD_CLICKWRAP_SITE_ID",
          label: "Clickwrap Site ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Enter the positive numeric ID of the single Clickwrap Site this connection may inspect.",
        },
      ],
    },
    tools: [
      {
        name: "ironcladClickwrap.getSite",
        functionName: "ironclad_clickwrap_site_get",
        aliases: ["ironcladClickwrap.getSite", "ironclad_clickwrap_site_get"],
        capability: "clickwrap_configuration_read",
        platformCapability: "ironclad_clickwrap_configuration_read",
        action: "read",
        approvalRequired: true,
        description:
          "Read a privacy-reduced summary of the exact configured Clickwrap Site.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "ironcladClickwrap.listContracts",
        functionName: "ironclad_clickwrap_contract_list",
        aliases: [
          "ironcladClickwrap.listContracts",
          "ironclad_clickwrap_contract_list",
        ],
        capability: "clickwrap_configuration_read",
        platformCapability: "ironclad_clickwrap_configuration_read",
        action: "read",
        approvalRequired: true,
        description:
          "List at most twenty-five privacy-reduced Contract summaries from page one of the exact configured Site.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
          additionalProperties: false,
        },
      },
      {
        name: "ironcladClickwrap.listGroups",
        functionName: "ironclad_clickwrap_group_list",
        aliases: [
          "ironcladClickwrap.listGroups",
          "ironclad_clickwrap_group_list",
        ],
        capability: "clickwrap_configuration_read",
        platformCapability: "ironclad_clickwrap_configuration_read",
        action: "read",
        approvalRequired: true,
        description:
          "List at most twenty-five privacy-reduced Clickwrap Group summaries from page one of the exact configured Site.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "ironclad_clickwrap_safe",
        label: "Safe",
        description:
          "Every Clickwrap configuration read requires approval because the customer-owned token inherits its creating user's Site permissions; signer activity, agreement content, records, exports and writes are outside Relay's V1 surface.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: reads,
        blockedActions: [],
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The three selected bounded reads run without Relay per-action approval; exact Site binding, token secrecy, fixed routing, response reduction, audits, provider permissions and Ironclad limits still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: [],
      },
    ],
    healthChecks: [
      {
        id: "site",
        label: "Ironclad Clickwrap token and exact-Site validation",
      },
    ],
  };
