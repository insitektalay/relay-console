import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const DIALPAD_SCOPES = ["offline_access"];

const reads = [
  action(
    "dialpad_user_get",
    "Verify connected user",
    "Verify the exact OAuth-bound Dialpad user without exposing provider IDs, email, extension, organization or status metadata.",
  ),
  action(
    "dialpad_caller_id_get",
    "Read caller-ID choices",
    "Read at most ten deduplicated privacy-masked Caller ID choices from the own user's current Dialpad schema; forwarding numbers are excluded.",
  ),
];

const blocks = [
  blocked(
    "dialpad_identity_company_admin",
    "Block identity, organization and administration",
    "Provider user ID, email, extension, state, license, company, office, groups, directories, voicemail settings, app settings and administration are unavailable.",
  ),
  blocked(
    "dialpad_sensitive_communications",
    "Block communications and sensitive artifacts",
    "Calls, callbacks, SMS, fax, recordings, transcripts, messages, voicemail, forwarding numbers, routing, contacts, contact-center data and every communication action are unavailable.",
  ),
  blocked(
    "dialpad_special_scopes_products_raw",
    "Block special scopes, other products and raw access",
    "calls:list, recordings_export, message exports, screen_pop, change_log, devices, events, webhooks, websockets, AI products, sandbox, pagination, exports, writes and raw APIs are unavailable.",
  ),
];

export const DIALPAD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "dialpad",
  name: "Dialpad",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.dialpad.com/docs/oauth",
  providerWebsiteUrl: "https://www.dialpad.com/",
  capabilities: [
    {
      ...capability(
        "user_read",
        "Verify connected user",
        "Verify the exact signed-in Dialpad user without exposing provider identity.",
        true,
      ),
      platformCapability: "user_read",
    },
    {
      ...capability(
        "caller_id_read",
        "Read caller-ID choices",
        "Inspect at most ten deduplicated privacy-masked own-user Caller ID choices without forwarding numbers.",
        true,
      ),
      platformCapability: "caller_id_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://dialpad.com/oauth2/authorize",
      tokenUrl: "https://dialpad.com/oauth2/token",
      userInfoUrl: "https://dialpad.com/api/v2/users/me",
      requiredScopes: DIALPAD_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "DIALPAD_CLIENT_ID",
        label: "Dialpad OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held client ID for a reviewed Dialpad OAuth app requesting only the additional offline_access scope.",
      },
      {
        name: "DIALPAD_CLIENT_SECRET",
        label: "Dialpad OAuth client secret",
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
      name: "relay_dialpad_get_user",
      functionName: "relay_dialpad_get_user",
      aliases: ["dialpad_user_get"],
      capability: "user_read",
      platformCapability: "user_read",
      action: "read",
      approvalRequired: false,
      description:
        "Verify the exact OAuth-bound Dialpad user without exposing provider identity.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_dialpad_get_caller_id",
      functionName: "relay_dialpad_get_caller_id",
      aliases: ["dialpad_caller_id_get"],
      capability: "caller_id_read",
      platformCapability: "caller_id_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most ten privacy-masked own-user Caller ID choices from the current provider schema without forwarding numbers.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "dialpad_safe",
      label: "Safe",
      description:
        "The two selected fixed reads run automatically; provider identity, forwarding numbers, communications, special scopes, organization data, writes and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two reads run without Relay per-action approval; exact user binding, fixed routes, response bounds, audits, masking and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "self_user",
      label: "Connected self user and offline refresh",
      requiredScopes: DIALPAD_SCOPES,
    },
  ],
};
