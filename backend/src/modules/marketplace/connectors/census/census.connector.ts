import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "census_dataset_readiness_summary_get",
    "Get Census dataset readiness summary",
    "Return only the workspace dataset count without dataset identity, SQL, sources, destinations, syncs, runs, or customer data.",
  ),
];

export const CENSUS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "census",
  name: "Census",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://fivetran.com/docs/activations/rest-api/api-reference/workspace-apis/datasets/list-datasets",
  providerWebsiteUrl: "https://www.getcensus.com/",
  capabilities: [
    {
      ...capability(
        "dataset_readiness_summary_read",
        "Read dataset readiness summary",
        "Read one identity-free aggregate dataset count from the Census workspace.",
        true,
      ),
      platformCapability: "census_dataset_readiness_summary_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CENSUS_API_KEY",
        label: "Census workspace API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a separate workspace API key for Relay in Census/Fivetran Activations API Access, store it securely, and regenerate or delete it if exposure is suspected.",
      },
    ],
  },
  tools: [
    {
      name: "census.getDatasetReadinessSummary",
      functionName: "census_dataset_readiness_summary_get",
      aliases: [
        "census.getDatasetReadinessSummary",
        "census_dataset_readiness_summary_get",
      ],
      capability: "dataset_readiness_summary_read",
      platformCapability: "census_dataset_readiness_summary_read",
      action: "read",
      approvalRequired: true,
      description: "Read only the aggregate workspace dataset count.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
  approvalProfiles: [
    {
      id: "census_safe",
      label: "Safe",
      description:
        "The bounded dataset count requires approval; dataset identity, SQL, customer data, connections, syncs, runs, writes, administration, raw APIs, and bulk remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded count runs directly; workspace ownership, redaction, response cap, audits, and provider limits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "datasets", label: "Census key and dataset-list validation" },
  ],
};
