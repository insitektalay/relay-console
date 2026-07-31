import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "vonage_account_balance_get",
    "Read account balance",
    "Read only the current Vonage Communications APIs account balance in EUR and whether auto-reload is enabled.",
  ),
];
const blocks = [
  blocked(
    "vonage_communications_content_identity",
    "Block communications, content, and identity",
    "SMS, MMS, WhatsApp, RCS, voice, video, Verify, Conversations, Messages, calls, recordings, transcripts, phone numbers, recipients, users, and content are unavailable.",
  ),
  blocked(
    "vonage_account_financial_writes",
    "Block financial and account writes",
    "Top-ups, auto-reload changes, payments, pricing changes, account settings, callbacks, webhooks, subaccounts, reports, and billing mutations are unavailable.",
  ),
  blocked(
    "vonage_credentials_admin_raw",
    "Block credential administration and raw access",
    "Secret listing, creation, retrieval, revocation, application/private-key/JWT management, arbitrary hosts, paths, queries, retries, writes, deletes, and raw APIs are unavailable.",
  ),
];

export const VONAGE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vonage",
  name: "Vonage",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.vonage.com/en/api/account?source=account",
  providerWebsiteUrl: "https://www.vonage.com/communications-apis/",
  capabilities: [
    {
      ...capability(
        "account_balance_read",
        "Read account balance",
        "Inspect the connected Communications APIs account's EUR balance and auto-reload state through one fixed read.",
        true,
      ),
      platformCapability: "account_balance_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VONAGE_API_KEY",
        label: "Vonage API key",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The Communications APIs account identifier used only as the HTTP Basic username for the fixed balance read.",
      },
      {
        name: "VONAGE_API_SECRET",
        label: "Dedicated secondary API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated secondary secret for Relay. Relay encrypts it and exposes only the balance read; revoke it in Vonage Dashboard/API Settings on disconnect.",
      },
    ],
  },
  tools: [
    {
      name: "relay_vonage_get_account_balance",
      functionName: "relay_vonage_get_account_balance",
      aliases: ["vonage_account_balance_get"],
      capability: "account_balance_read",
      platformCapability: "account_balance_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the connected Vonage Communications APIs account's balance in EUR and auto-reload state.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "vonage_safe",
      label: "Safe",
      description:
        "The one fixed balance read runs automatically; communications, content, account writes, top-ups, credential administration, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same fixed read runs without Relay per-action approval; the exact credential, route, response shape, audits, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "dedicated_api_secret", label: "Dedicated Vonage API secret" },
  ],
};
