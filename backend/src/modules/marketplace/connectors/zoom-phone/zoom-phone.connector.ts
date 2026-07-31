import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZOOM_PHONE_REQUIRED_SCOPE =
  "number_management:read:list_numbers:admin";

const reads = [
  action(
    "zoom_phone_numbers_list",
    "List Zoom Phone numbers",
    "List one bounded page of masked Zoom Phone number-inventory metadata.",
  ),
];

const blockedActions = [
  blocked(
    "zoom_phone_private_number_data",
    "Block private number data",
    "Full numbers, raw IDs, assignee names and IDs, extensions, caller-ID and display names, emergency addresses, sites, locations, SIP groups, and carrier details are not returned.",
  ),
  blocked(
    "zoom_phone_number_mutation",
    "Block number changes",
    "Allocation, assignment, deletion, porting, ordering, address, site, caller-ID, capability, and routing changes are not exposed.",
  ),
  blocked(
    "zoom_phone_calls_messages_content",
    "Block communications data",
    "Call history and logs, recordings, transcripts, voicemail, SMS, contacts, participants, diagnostics, and call control are not exposed.",
  ),
  blocked(
    "zoom_phone_raw_api",
    "Block raw Zoom API",
    "Arbitrary Zoom paths, products, filters, page tokens, origins, headers, bodies, and raw access tokens are not exposed.",
  ),
];

export const ZOOM_PHONE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoom-phone",
  name: "Zoom Phone",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.zoom.us/docs/api/number-management/",
  providerWebsiteUrl: "https://www.zoom.com/en/products/voip-phone/",
  capabilities: [
    {
      ...capability(
        "number_inventory",
        "Read masked number inventory",
        "Inspect bounded Zoom Phone number state without private assignment, address, or full-number data.",
        true,
      ),
      platformCapability: "zoom_phone_number_inventory",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ZOOM_PHONE_ACCOUNT_ID",
        label: "Zoom account ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Account ID from a customer-owned Zoom Server-to-Server OAuth app restricted to the listed granular scope.",
      },
      {
        name: "ZOOM_PHONE_CLIENT_ID",
        label: "Zoom Server-to-Server OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Client ID from the customer's dedicated Zoom app.",
      },
      {
        name: "ZOOM_PHONE_CLIENT_SECRET",
        label: "Zoom Server-to-Server OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Railway stores the client secret encrypted and uses it only at zoom.us/oauth/token.",
      },
    ],
  },
  tools: [
    {
      name: "zoomPhone.listNumbers",
      functionName: "zoom_phone_numbers_list",
      aliases: ["zoomPhone.listNumbers", "zoom_phone_numbers_list"],
      capability: "number_inventory",
      platformCapability: "zoom_phone_number_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page of masked numbers allocated to Zoom Phone.",
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
      id: "zoom_phone_safe",
      label: "Safe",
      description:
        "Every organization-wide masked Zoom Phone number-inventory read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected masked inventory reads run without Relay per-action approval while the fixed Zoom origins, product filter, bound, redaction, audit, scope, account roles, licensing, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "number_inventory",
      label: "Zoom Phone number-inventory authorization",
      requiredScopes: [ZOOM_PHONE_REQUIRED_SCOPE],
    },
  ],
};
