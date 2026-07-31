import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const RINGCENTRAL_PERMISSIONS = ["ReadAccounts", "ReadCallLog"];

const reads = [
  action(
    "ringcentral_extension_get",
    "Verify connected extension",
    "Verify the exact OAuth-bound RingCentral extension without exposing provider IDs, extension number or email.",
  ),
  action(
    "ringcentral_call_log_list",
    "List recent call activity",
    "List at most ten first-page Simple-view records with names removed and phone numbers masked.",
  ),
  action(
    "ringcentral_call_log_get",
    "Read one bounded call record",
    "Read one record only after its ID appears in the connected extension's first ten recent records.",
  ),
];

const blocks = [
  blocked(
    "ringcentral_mutations_communications",
    "Block communications and mutations",
    "Calls, RingOut, call control, SMS, fax, messages, voicemail, Team Messaging, webhooks, subscriptions and every write are unavailable.",
  ),
  blocked(
    "ringcentral_sensitive_adjacent",
    "Block sensitive adjacent data",
    "Names, raw phone numbers, email, extension and account IDs, detailed legs, telephony sessions, active calls, recordings, content, downloads and analytics are unavailable.",
  ),
  blocked(
    "ringcentral_admin_products_raw",
    "Block administration, other products and raw access",
    "Account-wide and other-extension data, directories, contacts, presence, Video, Meetings, Webinars, Events, RingCX, Contact Center, partner domains, later pages, exports and raw APIs are unavailable.",
  ),
];

export const RINGCENTRAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ringcentral",
  name: "RingCentral",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.ringcentral.com/guide/voice/call-log/api",
  providerWebsiteUrl: "https://www.ringcentral.com/",
  capabilities: [
    {
      ...capability(
        "extension_read",
        "Verify connected extension",
        "Verify the exact signed-in RingCentral extension without exposing its provider identity.",
        true,
      ),
      platformCapability: "extension_read",
    },
    {
      ...capability(
        "call_log_list",
        "List recent call activity",
        "List at most ten privacy-masked first-page Simple-view call records.",
        true,
      ),
      platformCapability: "call_log_list",
    },
    {
      ...capability(
        "call_log_read",
        "Read one bounded call record",
        "Inspect one record already verified in the first ten recent records.",
        true,
      ),
      platformCapability: "call_log_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://platform.ringcentral.com/restapi/oauth/authorize",
      tokenUrl: "https://platform.ringcentral.com/restapi/oauth/token",
      userInfoUrl:
        "https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~",
      requiredScopes: RINGCENTRAL_PERMISSIONS,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "RINGCENTRAL_CLIENT_ID",
        label: "RingCentral OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held client ID for a RingCentral app configured with exactly ReadAccounts and ReadCallLog.",
      },
      {
        name: "RINGCENTRAL_CLIENT_SECRET",
        label: "RingCentral OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held secret used only for authorization-session revocation; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_ringcentral_get_extension",
      functionName: "relay_ringcentral_get_extension",
      aliases: ["ringcentral_extension_get"],
      capability: "extension_read",
      platformCapability: "extension_read",
      action: "read",
      approvalRequired: false,
      description:
        "Verify the exact signed-in RingCentral extension without exposing provider identity.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_ringcentral_list_call_log",
      functionName: "relay_ringcentral_list_call_log",
      aliases: ["ringcentral_call_log_list"],
      capability: "call_log_list",
      platformCapability: "call_log_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most ten first-page Simple-view records with phone numbers masked and names removed.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "relay_ringcentral_get_call_log_record",
      functionName: "relay_ringcentral_get_call_log_record",
      aliases: ["ringcentral_call_log_get"],
      capability: "call_log_read",
      platformCapability: "call_log_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one privacy-masked record already present in the first ten recent records.",
      inputSchema: {
        type: "object",
        properties: {
          recordId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,128}$",
          },
        },
        required: ["recordId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "ringcentral_safe",
      label: "Safe",
      description:
        "The three selected fixed reads run automatically; provider identity, sensitive communications data, mutations, broad authority, later pages and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three reads run without Relay per-action approval; exact extension binding, app permissions, fixed routes, bounds, audits and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "self_extension",
      label: "Connected self extension and exact app permissions",
      requiredScopes: RINGCENTRAL_PERMISSIONS,
    },
  ],
};
