import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "disco_ediscovery_datasets_list",
    "List DISCO eDiscovery API datasets",
    "List available read-only DISCO API dataset identifiers for the exact bound organization without returning matters, review database identifiers, documents, users, or raw rows.",
  ),
  action(
    "disco_ediscovery_usage_summary_get",
    "Get DISCO eDiscovery usage summary",
    "Read bounded data-usage and review-database-size counts for the exact bound organization while redacting matter names, review database identifiers, session identifiers, and row-level legal data.",
  ),
];

export const DISCO_EDISCOVERY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "disco-ediscovery",
    name: "DISCO eDiscovery",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.csdisco.com/",
    providerWebsiteUrl: "https://csdisco.com/offerings/ediscovery",
    capabilities: [
      {
        ...capability(
          "ediscovery_usage_analytics_read",
          "Read e-discovery usage analytics",
          "Read identity-free DISCO eDiscovery dataset availability and bounded usage-size analytics for one exact customer organization.",
          true,
        ),
        platformCapability: "disco_ediscovery_usage_analytics_read",
      },
    ],
    auth: {
      type: "custom",
      credentialSchema: [
        {
          name: "DISCO_EDISCOVERY_API_KEY",
          label: "DISCO API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["custom"],
          helpText:
            "Create or retrieve the DISCO-issued organization API key from the DISCO Settings API area after confirming Relay's outbound CIDR allowlist with the organization manager.",
        },
        {
          name: "DISCO_EDISCOVERY_ORGANIZATION_ID",
          label: "DISCO organization ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["custom"],
          helpText:
            "Bind one exact DISCO organization ID; Relay never lets agents choose another organization at runtime.",
        },
      ],
    },
    tools: [
      {
        name: "discoEdiscovery.listDatasets",
        functionName: "disco_ediscovery_datasets_list",
        aliases: [
          "discoEdiscovery.listDatasets",
          "disco_ediscovery_datasets_list",
        ],
        capability: "ediscovery_usage_analytics_read",
        platformCapability: "disco_ediscovery_usage_analytics_read",
        action: "read",
        approvalRequired: true,
        description:
          "List DISCO's available read-only analytics dataset identifiers for the bound organization.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "discoEdiscovery.getUsageSummary",
        functionName: "disco_ediscovery_usage_summary_get",
        aliases: [
          "discoEdiscovery.getUsageSummary",
          "disco_ediscovery_usage_summary_get",
        ],
        capability: "ediscovery_usage_analytics_read",
        platformCapability: "disco_ediscovery_usage_analytics_read",
        action: "read",
        approvalRequired: true,
        description:
          "Read bounded DISCO usage and review database size counts for the bound organization.",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description:
                "Inclusive ISO-8601 start datetime for the data-usage summary.",
            },
            endDate: {
              type: "string",
              description:
                "Inclusive ISO-8601 end datetime for data-usage and review-size summaries.",
            },
          },
          required: ["startDate", "endDate"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "disco_ediscovery_safe",
        label: "Safe",
        description:
          "Bounded read-only analytics calls require approval; legal data, identities, documents, review work, exports, writes, raw APIs, and administration remain blocked.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: reads,
        blockedActions: [],
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same bounded read-only analytics calls run directly; exact organization binding, CIDR/API-key ownership, redaction, response caps, audits, and provider limits remain mandatory.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: [],
      },
    ],
    healthChecks: [
      {
        id: "datasets",
        label: "DISCO eDiscovery API key, organization, and CIDR validation",
      },
    ],
  };
