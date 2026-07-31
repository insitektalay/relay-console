import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "twilio_messages_list",
    "List recent message statuses",
    "Read at most ten masked Twilio message-status summaries without bodies, media, provider identifiers, prices, or error details.",
  ),
];
const blocks = [
  blocked(
    "twilio_communication_content_identity",
    "Block content, identity, and identifiers",
    "Message bodies, media, recordings, transcripts, participants, raw phone numbers, SIDs, account identity, error details, prices, and URIs are unavailable.",
  ),
  blocked(
    "twilio_live_communications",
    "Block live communications",
    "SMS, MMS, WhatsApp, voice calls, Verify, Conversations, notifications, bulk work, and all paid or recipient-facing sends are unavailable.",
  ),
  blocked(
    "twilio_admin_writes_raw",
    "Block administration, writes, and raw access",
    "Phone-number, Messaging Service, Studio, webhook, compliance, IAM, credential, account, subaccount, billing, arbitrary filter, pagination, write, delete, and raw API access are unavailable.",
  ),
];

export const TWILIO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "twilio",
  name: "Twilio",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.twilio.com/docs/messaging/api/message-resource",
  providerWebsiteUrl: "https://www.twilio.com/",
  capabilities: [
    {
      ...capability(
        "message_status_read",
        "List masked message statuses",
        "Inspect at most ten recent privacy-masked message delivery summaries from one Twilio account.",
        true,
      ),
      platformCapability: "message_status_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TWILIO_ACCOUNT_SID",
        label: "Twilio Account SID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Exact AC-prefixed account identifier bound into Relay's fixed Messages path.",
      },
      {
        name: "TWILIO_API_KEY_SID",
        label: "Restricted API Key SID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated SK-prefixed Restricted API key permitted only to GET the account Messages collection.",
      },
      {
        name: "TWILIO_API_KEY_SECRET",
        label: "Restricted API Key secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Relay encrypts this secret and uses it only as the HTTP Basic password for the fixed Twilio read. Delete the key in Twilio Console to revoke provider access.",
      },
    ],
  },
  tools: [
    {
      name: "relay_twilio_list_message_statuses",
      functionName: "relay_twilio_list_message_statuses",
      aliases: ["twilio_messages_list"],
      capability: "message_status_read",
      platformCapability: "message_status_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most ten masked Twilio message direction, status, address-suffix, and date summaries.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "twilio_safe",
      label: "Safe",
      description:
        "The one fixed masked status read runs automatically; content, identifiers, sends, administration, writes, pagination, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same fixed read runs without Relay per-action approval; the exact Restricted-key authority, route, masking, bounds, audits, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "restricted_api_key", label: "Twilio Restricted API key" },
  ],
};
