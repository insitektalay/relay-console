import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const WEBEX_CALLING_REQUIRED_SCOPES = [
  "spark-admin:telephony_config_read",
] as const;

const reads = [
  action(
    "webex_calling_numbers_list",
    "List masked calling numbers",
    "List one bounded page of masked Webex Calling number-inventory metadata.",
  ),
];

const blockedActions = [
  blocked(
    "webex_calling_private_identity",
    "Block private identity and location",
    "Full phone numbers, full extensions, routing prefixes, enterprise significant numbers, owner IDs and names, location IDs and names, mobile networks, and routing profiles are not returned.",
  ),
  blocked(
    "webex_calling_configuration_mutation",
    "Block Calling configuration changes",
    "Number assignment, activation, porting, location, routing, trunks, plans, queues, auto attendants, voicemail, emergency settings, policies, and all other configuration writes are not exposed.",
  ),
  blocked(
    "webex_calling_calls_content",
    "Block calls and communications content",
    "Active calls, call history, CDRs, participants, voicemail, recordings, transcripts, messages, contacts, dialing, answering, transfer, redirect, media, and tones are not exposed.",
  ),
  blocked(
    "webex_calling_raw_api",
    "Block raw Webex API access",
    "Arbitrary paths, filters, cursors, origins, headers, bodies, access tokens, pagination, bulk export, and adjacent Webex products are not exposed.",
  ),
];

export const WEBEX_CALLING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "webex-calling",
  name: "Webex Calling",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.webex.com/calling/docs/api/v1/numbers",
  providerWebsiteUrl: "https://www.webex.com/suite/calling.html",
  capabilities: [
    {
      ...capability(
        "number_inventory",
        "Read masked number inventory",
        "Inspect bounded Webex Calling number state and type without owner, location, routing, or full-number data.",
        true,
      ),
      platformCapability: "webex_calling_number_inventory",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://webexapis.com/v1/authorize",
      tokenUrl: "https://webexapis.com/v1/access_token",
      requiredScopes: [...WEBEX_CALLING_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "WEBEX_CLIENT_ID",
        label: "Relay Webex Integration client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Railway-held Relay Webex Integration client ID registered for the exact Calling read scope.",
      },
      {
        name: "WEBEX_CLIENT_SECRET",
        label: "Relay Webex Integration client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Railway-held confidential secret used only for Webex authorization-code and rotating-refresh exchanges; PKCE remains required.",
      },
    ],
  },
  tools: [
    {
      name: "webexCalling.listNumbers",
      functionName: "webex_calling_numbers_list",
      aliases: ["webexCalling.listNumbers", "webex_calling_numbers_list"],
      capability: "number_inventory",
      platformCapability: "webex_calling_number_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page of masked Webex Calling number-inventory metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId: { type: "string", minLength: 1, maxLength: 200 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "webex_calling_safe",
      label: "Safe",
      description:
        "Every organization-wide masked number-inventory read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected masked inventory reads run without Relay per-action approval while fixed Webex origins, endpoint, bounds, masking, audits, OAuth scope, admin role, licensing, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "number_inventory",
      label: "Webex Calling number-inventory authorization",
      requiredScopes: [...WEBEX_CALLING_REQUIRED_SCOPES],
    },
  ],
};
