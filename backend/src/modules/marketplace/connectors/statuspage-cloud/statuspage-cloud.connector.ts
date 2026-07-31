import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "statuspage_cloud_list_components",
    "List components",
    "List at most 25 bounded component summaries for the bound page.",
  ),
  action(
    "statuspage_cloud_list_incidents",
    "List incidents",
    "List at most 25 bounded incident summaries for the bound page.",
  ),
];
const writes = [
  action(
    "statuspage_cloud_update_component_status",
    "Update component status",
    "Set one exact component to one documented operational status; Safe mode requires approval.",
  ),
];
const blockedActions = [
  blocked(
    "statuspage_cloud_notify_or_create_incident",
    "Create incidents or notify subscribers",
    "Incident creation and notification delivery are unavailable in this bounded connector.",
  ),
  blocked(
    "statuspage_cloud_admin",
    "Administer Statuspage",
    "Deleting resources, managing subscribers, users, templates, metrics, access groups, and account configuration is blocked.",
  ),
];

export const STATUSPAGE_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "statuspage-cloud",
    name: "Statuspage Cloud",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.statuspage.io/",
    providerWebsiteUrl: "https://www.atlassian.com/software/statuspage",
    capabilities: [
      {
        ...capability(
          "status_read",
          "Read status",
          "List bounded component and incident summaries for one exact Statuspage.",
          true,
        ),
        platformCapability: "statuspage_cloud_status_read",
      },
      {
        ...capability(
          "component_status_write",
          "Update component status",
          "Set one exact component to one documented operational status.",
          true,
        ),
        platformCapability: "statuspage_cloud_component_status_write",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "STATUSPAGE_API_TOKEN",
          label: "Statuspage API token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText: "Copy an API token authorized for the intended Statuspage.",
        },
        {
          name: "STATUSPAGE_PAGE_ID",
          label: "Statuspage page ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText: "Bind this connection to one exact Statuspage page ID.",
        },
      ],
    },
    tools: [
      {
        name: "statuspageCloud.listComponents",
        functionName: "statuspage_cloud_list_components",
        aliases: [
          "statuspageCloud.listComponents",
          "statuspage_cloud_list_components",
        ],
        capability: "status_read",
        platformCapability: "statuspage_cloud_status_read",
        action: "read",
        approvalRequired: false,
        description: "List at most 25 bounded component summaries.",
        inputSchema: emptySchema(),
      },
      {
        name: "statuspageCloud.listIncidents",
        functionName: "statuspage_cloud_list_incidents",
        aliases: [
          "statuspageCloud.listIncidents",
          "statuspage_cloud_list_incidents",
        ],
        capability: "status_read",
        platformCapability: "statuspage_cloud_status_read",
        action: "read",
        approvalRequired: false,
        description: "List at most 25 bounded incident summaries.",
        inputSchema: emptySchema(),
      },
      {
        name: "statuspageCloud.updateComponentStatus",
        functionName: "statuspage_cloud_update_component_status",
        aliases: [
          "statuspageCloud.updateComponentStatus",
          "statuspage_cloud_update_component_status",
        ],
        capability: "component_status_write",
        platformCapability: "statuspage_cloud_component_status_write",
        action: "write",
        approvalRequired: true,
        description: "Update one exact component to one documented status.",
        inputSchema: {
          type: "object",
          properties: {
            componentId: { type: "string", minLength: 1, maxLength: 100 },
            status: {
              type: "string",
              enum: [
                "operational",
                "degraded_performance",
                "partial_outage",
                "major_outage",
                "under_maintenance",
              ],
            },
            approvalId: { type: "string" },
          },
          required: ["componentId", "status"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "statuspage_cloud_safe",
        label: "Safe",
        description:
          "Bounded reads run directly; every component-status change requires approval.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: writes,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Selected reads and component-status changes run without Relay per-action approval; page binding, provider authority, bounds, and audits still apply.",
        defaultSelected: false,
        allowedActions: [...reads, ...writes],
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      { id: "list_components", label: "List bound-page components" },
    ],
  };

function emptySchema() {
  return { type: "object", properties: {}, additionalProperties: false };
}
