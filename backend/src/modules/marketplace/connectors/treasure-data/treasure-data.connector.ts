import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "treasure_data_database_readiness_summary_get",
    "Get Treasure Data database readiness summary",
    "Return only database and delete-protected counts without database identity, record counts, permissions, tables, schemas, queries, jobs, or customer data.",
  ),
];

export const TREASURE_DATA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "treasure-data",
  name: "Treasure Data",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.treasure.ai/apis/td-api",
  providerWebsiteUrl: "https://www.treasuredata.com/",
  capabilities: [
    {
      ...capability(
        "database_readiness_summary_read",
        "Read database readiness summary",
        "Read one identity-free database inventory aggregate in the bound Treasure Data region.",
        true,
      ),
      platformCapability: "treasure_data_database_readiness_summary_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TREASURE_DATA_API_KEY",
        label: "Treasure Data API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated Master-type key owned by a restricted user whose policy grants only the minimum database visibility required. Relay never exposes the key.",
      },
      {
        name: "TREASURE_DATA_API_REGION",
        label: "Treasure Data API region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Choose exactly one of us, tokyo, ap02, or eu01.",
      },
    ],
  },
  tools: [
    {
      name: "treasureData.getDatabaseReadinessSummary",
      functionName: "treasure_data_database_readiness_summary_get",
      aliases: [
        "treasureData.getDatabaseReadinessSummary",
        "treasure_data_database_readiness_summary_get",
      ],
      capability: "database_readiness_summary_read",
      platformCapability: "treasure_data_database_readiness_summary_read",
      action: "read",
      approvalRequired: true,
      description: "Read only identity-free database readiness counts.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
  approvalProfiles: [
    {
      id: "treasure_data_safe",
      label: "Safe",
      description:
        "The bounded database readiness read requires approval; identity, records, tables, queries, jobs, imports, exports, writes, administration, raw APIs, and bulk remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded read runs directly; restricted-user authority, region binding, redaction, response cap, audits, and provider limits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "databases", label: "Treasure Data region, key, and database-list validation" },
  ],
};
