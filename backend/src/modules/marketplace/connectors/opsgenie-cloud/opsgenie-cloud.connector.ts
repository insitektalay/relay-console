import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readActions = [
  action(
    "opsgenie_cloud_list_alerts",
    "List alerts",
    "List at most 25 bounded alert summaries for one exact US or EU Opsgenie account.",
  ),
  action(
    "opsgenie_cloud_get_alert",
    "Read one alert",
    "Read a bounded summary for one exact Opsgenie alert ID.",
  ),
];
const blockedActions = [
  blocked(
    "opsgenie_cloud_mutate_alerts",
    "Change alerts",
    "Creating, acknowledging, closing, deleting, or otherwise changing alerts is unavailable in this read-only legacy connector.",
  ),
  blocked(
    "opsgenie_cloud_manage_configuration",
    "Manage Opsgenie",
    "Users, teams, schedules, integrations, policies, services, and account configuration are unavailable.",
  ),
];

export const OPSGENIE_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "opsgenie-cloud",
  name: "Opsgenie Cloud",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.opsgenie.com/docs/api-overview",
  providerWebsiteUrl: "https://www.atlassian.com/software/opsgenie",
  capabilities: [
    {
      ...capability(
        "alerts_read",
        "Read alerts",
        "List bounded alert summaries and inspect one exact alert without mutations or configuration access.",
        true,
      ),
      platformCapability: "opsgenie_cloud_alerts_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "OPSGENIE_API_KEY",
        label: "Opsgenie API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a read-enabled account API key from an existing Opsgenie account.",
      },
      {
        name: "OPSGENIE_REGION",
        label: "Opsgenie region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter US or EU so Relay uses only the matching official Opsgenie origin.",
      },
    ],
  },
  tools: [
    {
      name: "opsgenieCloud.listAlerts",
      functionName: "opsgenie_cloud_list_alerts",
      aliases: ["opsgenieCloud.listAlerts", "opsgenie_cloud_list_alerts"],
      capability: "alerts_read",
      platformCapability: "opsgenie_cloud_alerts_read",
      action: "read",
      approvalRequired: false,
      description: "List up to 25 privacy-bounded Opsgenie alert summaries.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "acknowledged", "closed"] },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "opsgenieCloud.getAlert",
      functionName: "opsgenie_cloud_get_alert",
      aliases: ["opsgenieCloud.getAlert", "opsgenie_cloud_get_alert"],
      capability: "alerts_read",
      platformCapability: "opsgenie_cloud_alerts_read",
      action: "read",
      approvalRequired: false,
      description: "Read a bounded summary for one exact Opsgenie alert ID.",
      inputSchema: {
        type: "object",
        properties: {
          alertId: { type: "string", minLength: 1, maxLength: 100 },
        },
        required: ["alertId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "opsgenie_cloud_read_only",
      label: "Read only",
      description:
        "Bounded alert reads run directly; every mutation and configuration action remains blocked.",
      defaultSelected: true,
      allowedActions: readActions,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "list_one_alert", label: "List one bounded alert summary" },
  ],
};
