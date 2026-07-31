import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { VWO_READ_OPERATIONS } from "./vwo-api.adapter";

const read = action(
  "vwo_read",
  "List VWO projects",
  "List up to 100 current-account project IDs and names without environments, campaigns, features, visitors, results, or writes.",
);
const manage = blocked(
  "vwo_manage",
  "Access broader VWO data",
  "Campaigns, features, environments, websites, visitors, results, segments, notifications, arbitrary routes, and every mutation are outside Relay's V1 contract.",
);

export const VWO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vwo",
  name: "VWO",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.vwo.com/reference",
  providerWebsiteUrl: "https://vwo.com/",
  capabilities: [
    {
      ...capability(
        "vwo_read",
        "List projects",
        "Use only GET /api/v2/accounts/current/projects and return minimized project summaries.",
        true,
      ),
      platformCapability: "vwo_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VWO_API_TOKEN",
        label: "VWO API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned Enterprise API token with the least available permission level. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "vwo.listProjects",
      functionName: "vwo_read",
      aliases: ["vwo.listProjects", "vwo_read"],
      capability: "vwo_read",
      platformCapability: "vwo_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized VWO project summaries.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...VWO_READ_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "vwo_safe",
      label: "Safe",
      description:
        "One minimized current-account project-directory read runs directly. Environments, campaigns, features, visitors, results, arbitrary API access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "api_token_and_project_list",
      label: "API token and project-list access check",
    },
  ],
};
