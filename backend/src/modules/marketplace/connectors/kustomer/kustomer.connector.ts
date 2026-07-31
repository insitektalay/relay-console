import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "kustomer_conversation_list",
    "List conversation metadata",
    "List one fixed first page of content-free Kustomer conversation summaries.",
  ),
  action(
    "kustomer_conversation_get",
    "Read conversation metadata",
    "Read one exact Kustomer conversation through Relay's content-free projection.",
  ),
];
const full = [
  action(
    "kustomer_full_api",
    "Use Kustomer API v1",
    "Use a documented Kustomer API v1 operation authorized by the API key roles; Safe mode requires approval.",
  ),
];

export const KUSTOMER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "kustomer",
  name: "Kustomer",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.kustomer.com/",
  providerWebsiteUrl: "https://www.kustomer.com/",
  capabilities: [
    {
      ...capability(
        "conversation_metadata_read",
        "Read conversation operations",
        "List and inspect bounded conversation operational metadata without names, previews, customers, messages, notes, satisfaction, tags, custom fields, relationships, or raw records.",
        true,
      ),
      platformCapability: "kustomer_conversation_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Kustomer API v1",
        "Use documented fixed-origin API v1 paths and methods allowed by the connected key's roles.",
        true,
      ),
      platformCapability: "kustomer_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "KUSTOMER_API_KEY",
        label: "Kustomer API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated expiring API key with only the roles required by selected operations; Kustomer shows the key only once.",
      },
    ],
  },
  tools: [
    {
      name: "kustomer.listConversations",
      functionName: "kustomer_conversation_list",
      aliases: ["kustomer.listConversations", "kustomer_conversation_list"],
      capability: "conversation_metadata_read",
      platformCapability: "kustomer_conversation_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five page-one conversation summaries without names, previews, customers, messages, notes, satisfaction, tags, custom fields, relationships, or raw pagination URLs.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "kustomer.getConversation",
      functionName: "kustomer_conversation_get",
      aliases: ["kustomer.getConversation", "kustomer_conversation_get"],
      capability: "conversation_metadata_read",
      platformCapability: "kustomer_conversation_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact conversation's ID, status, channels, counts, spam flag, and timestamps through the same content-free projection.",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,128}$",
          },
        },
        required: ["conversationId"],
        additionalProperties: false,
      },
    },
    {
      name: "kustomer.request",
      functionName: "kustomer_request",
      aliases: ["kustomer.request", "kustomer_request", "kustomer_full_api"],
      capability: "full_api",
      platformCapability: "kustomer_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented API v1 operation on the fixed Kustomer origin. Absolute URLs, credentials, redirects, and version overrides are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          path: {
            type: "string",
            pattern: "^/v1/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$",
          },
          query: { type: "object" },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "kustomer_safe",
      label: "Safe",
      description:
        "Content-free conversation reads and every broader API operation require approval; fixed origin/version, secret isolation, key roles, bounds, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...full],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected key-authorized operations run without Relay per-action approval; fixed origin/version, secret isolation, bounds, audits, roles, and Kustomer limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...full],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_conversations",
      label: "Kustomer API key, roles, and bounded conversation-list check",
    },
  ],
};
