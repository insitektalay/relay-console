import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "messagebird_workspace_status_get",
    "Read workspace status",
    "Read only the selected Bird workspace's lifecycle status through one fixed metadata endpoint.",
  ),
];
const blocks = [
  blocked(
    "messagebird_communications_content_contacts",
    "Block communications, content, and contacts",
    "Messages, SMS, MMS, WhatsApp, email, voice, Verify, channels, conversations, contacts, lists, audiences, campaigns, templates, media, and customer content are unavailable.",
  ),
  blocked(
    "messagebird_account_billing_workspace_writes",
    "Block account, billing, and workspace writes",
    "Organization and workspace changes, numbers, senders, subscriptions, billing, payments, top-ups, webhooks, roles, policies, and other administrative operations are unavailable.",
  ),
  blocked(
    "messagebird_credentials_admin_raw",
    "Block credential administration and raw access",
    "Access-key listing, creation, inspection, update, deletion, arbitrary hosts, paths, queries, pagination, retries, writes, deletes, and raw APIs are unavailable.",
  ),
];

export const MESSAGEBIRD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "messagebird",
  name: "Bird (formerly MessageBird)",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.bird.com/api/accounts-api/api-reference/organizations/workspaces",
  providerWebsiteUrl: "https://bird.com/",
  capabilities: [
    {
      ...capability(
        "workspace_status_read",
        "Read workspace status",
        "Inspect only the selected Bird workspace's lifecycle status through one fixed read.",
        true,
      ),
      platformCapability: "workspace_status_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MESSAGEBIRD_ORGANIZATION_ID",
        label: "Bird organization ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The organization UUID containing the selected workspace.",
      },
      {
        name: "MESSAGEBIRD_WORKSPACE_ID",
        label: "Bird workspace ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The exact workspace UUID Relay is allowed to inspect.",
      },
      {
        name: "MESSAGEBIRD_ACCESS_KEY",
        label: "Dedicated read-only Bird AccessKey",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated key whose attached role allows View only on the selected workspace metadata route. Relay encrypts the key; delete it in Bird Security settings after disconnect.",
      },
    ],
  },
  tools: [
    {
      name: "relay_messagebird_get_workspace_status",
      functionName: "relay_messagebird_get_workspace_status",
      aliases: ["messagebird_workspace_status_get"],
      capability: "workspace_status_read",
      platformCapability: "workspace_status_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the selected Bird workspace's active, disabled, terminated, or deleted status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "messagebird_safe",
      label: "Safe",
      description:
        "The one fixed workspace-status read runs automatically; communications, content, contacts, billing, workspace writes, credential administration, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same fixed read runs without Relay per-action approval; the selected organization/workspace, exact route, response reduction, audits, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "dedicated_access_key", label: "Dedicated Bird AccessKey" },
  ],
};
