import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "mention_account_status_get",
    "Get Mention account status",
    "Read the exact bound account ID, language, and time zone without name, email, avatar, biography, social profiles, notification settings, or other identity.",
  ),
  action(
    "mention_alert_structure_list",
    "List Mention alert structure",
    "List at most twenty-five alert IDs, query types, and index versions for the exact account without names, keywords, descriptions, shares, users, content, or statistics.",
  ),
];

export const MENTION_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mention",
  name: "Mention",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://dev.mention.com/current/src/index.html",
  providerWebsiteUrl: "https://mention.com/",
  capabilities: [
    {
      ...capability(
        "alert_structure_read",
        "Read account and alert structure",
        "Read bounded identity- and content-redacted account status and alert structure for one exact Mention account.",
        true,
      ),
      platformCapability: "mention_alert_structure_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MENTION_ACCESS_TOKEN",
        label: "Mention access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated Mention app token for your own account. Relay encrypts it and sends it only as a Bearer header to https://api.mention.net.",
      },
      {
        name: "MENTION_ACCOUNT_ID",
        label: "Mention account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste one exact account ID from Mention's official account API.",
      },
    ],
  },
  tools: [
    {
      name: "mention.getAccountStatus",
      functionName: "mention_account_status_get",
      aliases: ["mention.getAccountStatus", "mention_account_status_get"],
      capability: "alert_structure_read",
      platformCapability: "mention_alert_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read the exact bound account ID, language, and time zone without private identity.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "mention.listAlerts",
      functionName: "mention_alert_structure_list",
      aliases: ["mention.listAlerts", "mention_alert_structure_list"],
      capability: "alert_structure_read",
      platformCapability: "mention_alert_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five alert IDs, query types, and index versions without names, keywords, users, content, or statistics.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "mention_safe",
      label: "Safe",
      description:
        "Both bounded reads require approval; identity, alert names and queries, Mention Content, authors, analytics, streams, writes, raw APIs, pagination, bulk, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two bounded reads run directly; exact account binding, fixed GET routes, redaction, response caps, audits, API-version pinning, and provider rate responses remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "account", label: "Mention token and exact account validation" },
  ],
};
