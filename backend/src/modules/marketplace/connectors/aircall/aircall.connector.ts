import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const AIRCALL_SCOPES = ["public_api"];
const reads = [
  action(
    "aircall_company_get",
    "Read connected company",
    "Read bounded aggregate details for the exact OAuth-bound Aircall company without exposing provider IDs or installer identity.",
  ),
  action(
    "aircall_numbers_list",
    "List company numbers",
    "Read the first ten company phone numbers with privacy-masked digits and without users, routing, recordings, messages or direct links.",
  ),
];
const blocks = [
  blocked(
    "aircall_users_installers_admin",
    "Block users, installers and administration",
    "Users, installer identity, email, provider IDs, teams, roles, settings and administration are unavailable.",
  ),
  blocked(
    "aircall_communications_recordings",
    "Block communications and sensitive artifacts",
    "Calls, SMS, MMS, WhatsApp, messages, recordings, voicemail, transcripts, contacts, routing, audio URLs and communication intelligence are unavailable.",
  ),
  blocked(
    "aircall_writes_exports_raw",
    "Block writes, exports and raw access",
    "Dialing, messages, AI voice, analytics exports, webhooks, pagination, arbitrary paths, writes, deletes and raw API access are unavailable.",
  ),
];

export const AIRCALL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "aircall",
  name: "Aircall",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.aircall.io/api-references/",
  providerWebsiteUrl: "https://aircall.io/",
  capabilities: [
    {
      ...capability(
        "company_read",
        "Read connected company",
        "Inspect bounded aggregate details for the exact OAuth-bound Aircall company.",
        true,
      ),
      platformCapability: "company_read",
    },
    {
      ...capability(
        "phone_number_read",
        "List company numbers",
        "Inspect at most ten privacy-masked company phone numbers.",
        true,
      ),
      platformCapability: "phone_number_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://dashboard.aircall.io/oauth/authorize",
      tokenUrl: "https://api.aircall.io/v1/oauth/token",
      userInfoUrl: "https://api.aircall.io/v1/integrations/me",
      requiredScopes: AIRCALL_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "AIRCALL_CLIENT_ID",
        label: "Aircall OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held client ID for a reviewed Aircall technology-partner OAuth app.",
      },
      {
        name: "AIRCALL_CLIENT_SECRET",
        label: "Aircall OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-encrypted confidential OAuth secret; never sent to Relay clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_aircall_get_company",
      functionName: "relay_aircall_get_company",
      aliases: ["aircall_company_get"],
      capability: "company_read",
      platformCapability: "company_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded aggregate details for the exact OAuth-bound Aircall company.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_aircall_list_numbers",
      functionName: "relay_aircall_list_numbers",
      aliases: ["aircall_numbers_list"],
      capability: "phone_number_read",
      platformCapability: "phone_number_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most ten privacy-masked company phone numbers without sensitive routing or communications fields.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "aircall_safe",
      label: "Safe",
      description:
        "Two fixed company reads run automatically; installer identity, users, communications, recordings, routing, writes, pagination and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two fixed reads run without Relay per-action approval; exact company binding, masking, request bounds, audits and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "company_binding",
      label: "OAuth integration and company binding",
      requiredScopes: AIRCALL_SCOPES,
    },
  ],
};
