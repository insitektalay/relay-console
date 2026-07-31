import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "openphone_phone_numbers_list",
    "List workspace phone numbers",
    "Read at most ten privacy-masked Quo workspace phone-number labels without provider IDs, users, forwarding, restrictions, or raw digits.",
  ),
];
const blocks = [
  blocked(
    "openphone_users_contacts_identity",
    "Block users, contacts, and identity",
    "Users, owner/admin identity, email, roles, groups, Contacts, custom fields, and provider IDs are unavailable.",
  ),
  blocked(
    "openphone_communications_content",
    "Block communications and content",
    "Calls, recordings, transcripts, voicemail, Conversations, Messages, participants, forwarding, AI output, webhooks, and communication content are unavailable.",
  ),
  blocked(
    "openphone_writes_billing_raw",
    "Block writes, billing, and raw access",
    "SMS/MMS sending, contact mutations, phone administration, carrier registration, paid messaging, later pages, arbitrary filters, writes, deletes, and raw APIs are unavailable.",
  ),
];

export const OPENPHONE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "openphone",
  name: "Quo (formerly OpenPhone)",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://openphone.mintlify.dev/docs/mdx/api-reference/introduction",
  providerWebsiteUrl: "https://www.quo.com/",
  capabilities: [
    {
      ...capability(
        "phone_number_read",
        "List workspace phone numbers",
        "Inspect at most ten privacy-masked phone-number labels from the connected Quo workspace.",
        true,
      ),
      platformCapability: "phone_number_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "OPENPHONE_API_KEY",
        label: "Quo workspace API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Owner/admin-generated full-access workspace key. Relay encrypts it and sends it only in Quo's raw Authorization header; revoke it manually in Quo Workspace Settings.",
      },
    ],
  },
  tools: [
    {
      name: "relay_openphone_list_phone_numbers",
      functionName: "relay_openphone_list_phone_numbers",
      aliases: ["openphone_phone_numbers_list"],
      capability: "phone_number_read",
      platformCapability: "phone_number_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most ten privacy-masked Quo workspace phone-number labels without sensitive adjacent fields.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "openphone_safe",
      label: "Safe",
      description:
        "The one fixed masked-number read runs automatically; users, contacts, communications, content, writes, billing, pagination, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same fixed read runs without Relay per-action approval; exact encrypted key authority, route, bounds, masking, audits, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "workspace_key", label: "Quo full-access workspace API key" },
  ],
};
