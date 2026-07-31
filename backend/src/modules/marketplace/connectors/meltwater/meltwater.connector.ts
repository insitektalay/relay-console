import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "meltwater_api_usage_get",
    "Get Meltwater API usage",
    "Read only total request count, time unit, and time-series point count for the last twenty-four hours, excluding token IDs and endpoint-level call details.",
  ),
  action(
    "meltwater_search_reference_list",
    "List Meltwater search references",
    "List at most twenty-five saved-search IDs and update timestamps without names, queries, keywords, filter sets, content, or analytics.",
  ),
];

export const MELTWATER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "meltwater",
  name: "Meltwater",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.meltwater.com/api-reference/api-reference-overview/",
  providerWebsiteUrl: "https://www.meltwater.com/",
  capabilities: [
    {
      ...capability(
        "media_intelligence_structure_read",
        "Read API usage and search structure",
        "Read a redacted 24-hour API-usage summary and at most twenty-five saved-search ID/update references for the token's default company.",
        true,
      ),
      platformCapability: "meltwater_media_intelligence_structure_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MELTWATER_API_TOKEN",
        label: "Meltwater API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated token under Account > Meltwater API. Relay encrypts it and sends it only as the apikey header to https://api.meltwater.com.",
      },
    ],
  },
  tools: [
    {
      name: "meltwater.getApiUsage",
      functionName: "meltwater_api_usage_get",
      aliases: ["meltwater.getApiUsage", "meltwater_api_usage_get"],
      capability: "media_intelligence_structure_read",
      platformCapability: "meltwater_media_intelligence_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read a redacted aggregate request-count summary for the last twenty-four hours.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "meltwater.listSearches",
      functionName: "meltwater_search_reference_list",
      aliases: ["meltwater.listSearches", "meltwater_search_reference_list"],
      capability: "media_intelligence_structure_read",
      platformCapability: "meltwater_media_intelligence_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five saved-search IDs and update timestamps without names or queries.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "meltwater_safe",
      label: "Safe",
      description:
        "Both bounded reads require approval; identity, search configuration, content, analytics, writes, imports, streams, raw APIs, pagination, bulk, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two bounded reads run directly; fixed GET routes, default-company authority, redaction, response caps, audits, and provider rate responses remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "usage", label: "Meltwater token and API-package validation" },
  ],
};
