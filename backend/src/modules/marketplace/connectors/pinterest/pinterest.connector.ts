import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const PINTEREST_SCOPES = [
  "user_accounts:read",
  "boards:read",
  "pins:read",
];
const reads = [
  action(
    "pinterest_user_account_get",
    "Read connected account",
    "Read the exact OAuth-bound Pinterest user account.",
  ),
  action(
    "pinterest_public_boards_list",
    "List public boards",
    "List at most ten public boards owned by the connected account.",
  ),
  action(
    "pinterest_public_pins_list",
    "List public Pins",
    "List at most ten public Pins owned by the connected account.",
  ),
  action(
    "pinterest_public_pin_get",
    "Read public Pin",
    "Read one exact public Pin only after verifying account ownership.",
  ),
];
const blocks = [
  blocked(
    "pinterest_private_or_write_actions",
    "Block private and write actions",
    "Secret boards and Pins, followers, ads, analytics, catalogs, search, creation, updates, deletion, saves and engagement are not registered.",
  ),
  blocked(
    "pinterest_raw_or_bulk_access",
    "Block raw and bulk access",
    "Bookmarks, automatic pagination, downloads, bulk work, arbitrary fields and raw Pinterest API access are unavailable.",
  ),
];

export const PINTEREST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "pinterest",
  name: "Pinterest",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/",
  providerWebsiteUrl: "https://www.pinterest.com/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "Read account",
        "Read the exact connected Pinterest user account.",
        true,
      ),
      platformCapability: "account_read",
    },
    {
      ...capability(
        "public_boards_read",
        "Read public boards",
        "List at most ten public boards owned by the connected account.",
        true,
      ),
      platformCapability: "public_boards_read",
    },
    {
      ...capability(
        "public_pins_read",
        "Read public Pins",
        "List at most ten public Pins and inspect one exact owned Pin.",
        true,
      ),
      platformCapability: "public_pins_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.pinterest.com/oauth/",
      tokenUrl: "https://api.pinterest.com/v5/oauth/token",
      refreshUrl: "https://api.pinterest.com/v5/oauth/token",
      userInfoUrl: "https://api.pinterest.com/v5/user_account",
      requiredScopes: PINTEREST_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "PINTEREST_APP_ID",
        label: "Pinterest app ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay public-app identifier.",
      },
      {
        name: "PINTEREST_APP_SECRET",
        label: "Pinterest app secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Railway-held app secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_pinterest_get_user_account",
      functionName: "relay_pinterest_get_user_account",
      aliases: ["pinterest_user_account_get"],
      capability: "account_read",
      platformCapability: "account_read",
      action: "read",
      approvalRequired: false,
      description: "Read the exact connected Pinterest account.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_pinterest_list_public_boards",
      functionName: "relay_pinterest_list_public_boards",
      aliases: ["pinterest_public_boards_list"],
      capability: "public_boards_read",
      platformCapability: "public_boards_read",
      action: "read",
      approvalRequired: false,
      description: "List at most ten owned public boards.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_pinterest_list_public_pins",
      functionName: "relay_pinterest_list_public_pins",
      aliases: ["pinterest_public_pins_list"],
      capability: "public_pins_read",
      platformCapability: "public_pins_read",
      action: "read",
      approvalRequired: false,
      description: "List at most ten owned public Pins.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_pinterest_get_public_pin",
      functionName: "relay_pinterest_get_public_pin",
      aliases: ["pinterest_public_pin_get"],
      capability: "public_pins_read",
      platformCapability: "public_pins_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact owned public Pin.",
      inputSchema: {
        type: "object",
        properties: {
          pinId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
        },
        required: ["pinId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "pinterest_safe",
      label: "Safe",
      description:
        "The four selected bounded public-account reads run automatically; private, write, raw and bulk surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four selected reads run without Relay per-action approval; exact account ownership, provider authority, bounds, audits and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "bound_user_account",
      label: "Exact Pinterest user account",
      requiredScopes: PINTEREST_SCOPES,
    },
  ],
};
