import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "bitrix24_profile_get",
    "Read webhook owner",
    "Read the bounded basic profile for the exact incoming-webhook owner.",
  ),
  action(
    "bitrix24_deal_list",
    "List deals",
    "List at most twenty-five bounded Deal summaries from the first fixed page.",
  ),
  action(
    "bitrix24_deal_get",
    "Read deal",
    "Read one exact bounded Deal by positive numeric ID.",
  ),
];

const blockedActions = [
  blocked(
    "bitrix24_record_mutation",
    "Change Bitrix24 data",
    "Creating, updating, moving, converting, merging, or deleting CRM records is outside V1.",
  ),
  blocked(
    "bitrix24_private_crm",
    "Read private CRM data",
    "Contacts, companies, leads, phone numbers, email addresses, comments, activities, files, products, custom fields, and communications are outside V1.",
  ),
  blocked(
    "bitrix24_broader_workspace",
    "Access broader workspace data",
    "Tasks, users beyond the webhook owner, chats, calls, calendars, Drive, sites, stores, automation, administration, and events are outside V1.",
  ),
  blocked(
    "bitrix24_raw_rest",
    "Call arbitrary REST methods",
    "Arbitrary methods, paths, fields, filters, sorting, pages, batches, and raw REST access are outside V1.",
  ),
  blocked(
    "bitrix24_bulk_export",
    "Export Bitrix24 data",
    "Automatic pagination, crawling, synchronization, batch APIs, and exports are outside V1.",
  ),
  blocked(
    "bitrix24_untrusted_host",
    "Call another host",
    "V1 accepts exact incoming webhook URLs only on documented Bitrix24 cloud zones; custom-domain and on-premise portals are excluded.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const BITRIX24_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bitrix24",
  name: "Bitrix24",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://apidocs.bitrix24.com/settings/how-to-call-rest-api/authorization.html",
  providerWebsiteUrl: "https://www.bitrix24.com/",
  capabilities: [
    {
      ...capability(
        "profile_read",
        "Read webhook owner",
        "Read bounded identity metadata for the exact user who owns the incoming webhook.",
        true,
      ),
      platformCapability: "bitrix24_profile_read",
    },
    {
      ...capability(
        "deal_read",
        "Read deals",
        "List bounded Deal summaries or inspect one exact Deal without contact, company, communication, product, file, or custom-field data.",
        true,
      ),
      platformCapability: "bitrix24_deal_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BITRIX24_WEBHOOK_URL",
        label: "Bitrix24 incoming webhook URL",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated cloud incoming webhook with CRM permission. The URL contains its secret and is stored encrypted on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "bitrix24.getProfile",
      functionName: "bitrix24_profile_get",
      aliases: ["bitrix24.getProfile", "bitrix24_profile_get"],
      capability: "profile_read",
      platformCapability: "bitrix24_profile_read",
      action: "read",
      approvalRequired: true,
      description: "Read the exact webhook owner's bounded basic profile.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "bitrix24.listDeals",
      functionName: "bitrix24_deal_list",
      aliases: ["bitrix24.listDeals", "bitrix24_deal_list"],
      capability: "deal_read",
      platformCapability: "bitrix24_deal_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded recently updated Deal summaries from the fixed first page.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "bitrix24.getDeal",
      functionName: "bitrix24_deal_get",
      aliases: ["bitrix24.getDeal", "bitrix24_deal_get"],
      capability: "deal_read",
      platformCapability: "bitrix24_deal_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Deal summary.",
      inputSchema: {
        type: "object",
        properties: {
          dealId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
          approvalId,
        },
        required: ["dealId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "bitrix24_safe",
      label: "Safe",
      description:
        "All three bounded identity and CRM reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact webhook-owner and portal binding, fixed methods and fields, provider permissions, limits, audits, redaction, and secret isolation remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "profile",
      label:
        "Bitrix24 cloud portal, incoming-webhook owner, credential, and CRM permission validation",
    },
  ],
};
