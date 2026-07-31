import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "onesignal_notification_delivery_summary_list",
    "List OneSignal notification delivery summaries",
    "Read page 0 of at most 25 delivery/count summaries with message and audience data excluded.",
  ),
];

export const ONESIGNAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "onesignal",
  name: "OneSignal",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://documentation.onesignal.com/reference/view-messages",
  providerWebsiteUrl: "https://onesignal.com/",
  capabilities: [
    {
      ...capability(
        "notification_delivery_summary_read",
        "Read notification delivery summaries",
        "Read at most 25 recent message delivery summaries without content, targeting, or recipient data.",
        true,
      ),
      platformCapability: "onesignal_notification_delivery_summary_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ONESIGNAL_APP_ID",
        label: "OneSignal App ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use the exact UUID v4 App ID from Settings > Keys & IDs.",
      },
      {
        name: "ONESIGNAL_APP_API_KEY",
        label: "OneSignal App API Key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use a dedicated App API Key, preferably IP-allowlisted.",
      },
    ],
  },
  tools: [
    {
      name: "onesignal.listNotificationDeliverySummaries",
      functionName: "onesignal_notification_delivery_summary_list",
      aliases: [
        "onesignal.listNotificationDeliverySummaries",
        "onesignal_notification_delivery_summary_list",
      ],
      capability: "notification_delivery_summary_read",
      platformCapability: "onesignal_notification_delivery_summary_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read page 0 of at most 25 notification delivery summaries with content and audience data excluded.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "onesignal_safe",
      label: "Safe",
      description:
        "The bounded summary read requires approval; message content, users, exports, sends, cancellation, writes, administration, arbitrary APIs, pagination, and bulk remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded read runs directly; exact app binding, redaction, response caps, audits, rate limits, and provider authorization remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "notifications", label: "OneSignal App API Key and App ID validation" },
  ],
};
