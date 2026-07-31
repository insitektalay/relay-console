import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "statuspage_read_summary",
    "Read current summary",
    "Read the bound public page's current status, components, unresolved incidents, and active or upcoming maintenance.",
  ),
  action(
    "statuspage_list_incidents",
    "List incidents",
    "List at most twenty-five bounded public incident lifecycle summaries.",
  ),
  action(
    "statuspage_list_scheduled_maintenances",
    "List scheduled maintenance",
    "List at most twenty-five bounded public scheduled-maintenance summaries.",
  ),
];
const blockedActions = [
  blocked(
    "statuspage_manage",
    "Manage Statuspage",
    "Management API keys and page, component, incident, maintenance, metric, template, and configuration changes are outside V1.",
  ),
  blocked(
    "statuspage_subscriber",
    "Manage subscribers",
    "Subscriber records, subscriptions, notification destinations, and resends are outside V1.",
  ),
  blocked(
    "statuspage_private_page",
    "Read private pages",
    "Private, audience-specific, and trial pages that require a full-control organization key are outside V1.",
  ),
  blocked(
    "statuspage_raw_api",
    "Use raw Statuspage API",
    "Arbitrary hosts, paths, page discovery, management endpoints, update bodies, pagination, and raw responses are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const STATUSPAGE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "statuspage",
  name: "Statuspage",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.atlassian.com/statuspage/docs/what-are-the-different-apis-under-statuspage/",
  providerWebsiteUrl: "https://www.atlassian.com/software/statuspage",
  capabilities: [
    {
      ...capability(
        "public_status_read",
        "Read public service status",
        "Read bounded current status, components, incidents, and scheduled maintenance from one exact public paid Statuspage.",
        true,
      ),
      platformCapability: "statuspage_public_status_read",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "STATUSPAGE_PUBLIC_PAGE_ID",
        label: "Statuspage public page ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["public_status_api"],
        helpText:
          "Enter the 8–32 character page ID for one launched public paid Statuspage; Relay derives the fixed page-id.statuspage.io Status API origin.",
      },
    ],
  },
  tools: [
    {
      name: "statuspage.readSummary",
      functionName: "statuspage_read_summary",
      aliases: ["statuspage.readSummary", "statuspage_read_summary"],
      capability: "public_status_read",
      platformCapability: "statuspage_public_status_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read the bound public page's current bounded status summary.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "statuspage.listIncidents",
      functionName: "statuspage_list_incidents",
      aliases: ["statuspage.listIncidents", "statuspage_list_incidents"],
      capability: "public_status_read",
      platformCapability: "statuspage_public_status_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded public incident lifecycle summaries.",
      inputSchema: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["all", "unresolved", "resolved"] },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "statuspage.listScheduledMaintenances",
      functionName: "statuspage_list_scheduled_maintenances",
      aliases: [
        "statuspage.listScheduledMaintenances",
        "statuspage_list_scheduled_maintenances",
      ],
      capability: "public_status_read",
      platformCapability: "statuspage_public_status_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded public scheduled-maintenance summaries.",
      inputSchema: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["all", "upcoming", "active"] },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "statuspage_safe",
      label: "Safe",
      description:
        "All three bounded public-status reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected public read-only tools run without Relay per-action approval while exact-page binding, response limits, redaction, audit, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "bound-public-page",
      label: "Exact public page ID and credentialless Status API validation",
    },
  ],
};
