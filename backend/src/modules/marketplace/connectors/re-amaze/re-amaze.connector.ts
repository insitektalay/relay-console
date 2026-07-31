import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "reamaze_conversation_list",
    "List conversation metadata",
    "List one fixed first page of content-free Re:amaze conversation summaries.",
  ),
  action(
    "reamaze_conversation_get",
    "Read conversation metadata",
    "Read one exact Re:amaze conversation through Relay's content-free projection.",
  ),
];
const full = [
  action(
    "reamaze_full_api",
    "Use Re:amaze API v1",
    "Use a documented Re:amaze API v1 operation authorized by the user's API token; Safe mode requires approval.",
  ),
];

export const REAMAZE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "re-amaze",
  name: "Re:amaze",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://support.reamaze.com/api",
  providerWebsiteUrl: "https://www.reamaze.com/",
  capabilities: [
    {
      ...capability(
        "conversation_metadata_read",
        "Read conversation operations",
        "List and inspect bounded conversation operational metadata without subjects, message bodies, authors, emails, assignees, followers, tags, channel names/addresses, custom data, or raw records.",
        true,
      ),
      platformCapability: "reamaze_conversation_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Re:amaze API v1",
        "Use documented brand-bound API v1 paths and methods allowed by the connected user's API token.",
        true,
      ),
      platformCapability: "reamaze_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "REAMAZE_BRAND",
        label: "Re:amaze brand",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter the brand hostname label before .reamaze.io.",
      },
      {
        name: "REAMAZE_LOGIN_EMAIL",
        label: "Re:amaze login email",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use the email of a dedicated least-privilege Re:amaze user.",
      },
      {
        name: "REAMAZE_API_TOKEN",
        label: "Re:amaze API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate the dedicated user's individual API token in Re:amaze settings.",
      },
    ],
  },
  tools: [
    {
      name: "reamaze.listConversations",
      functionName: "reamaze_conversation_list",
      aliases: ["reamaze.listConversations", "reamaze_conversation_list"],
      capability: "conversation_metadata_read",
      platformCapability: "reamaze_conversation_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five recently changed, non-archived conversation summaries from page one without message content, identities, custom data, or raw pagination metadata.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "reamaze.getConversation",
      functionName: "reamaze_conversation_get",
      aliases: ["reamaze.getConversation", "reamaze_conversation_get"],
      capability: "conversation_metadata_read",
      platformCapability: "reamaze_conversation_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact conversation's slug, status, numeric channel, and timestamps through the same content-free projection.",
      inputSchema: {
        type: "object",
        properties: {
          conversationSlug: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,200}$",
          },
        },
        required: ["conversationSlug"],
        additionalProperties: false,
      },
    },
    {
      name: "reamaze.request",
      functionName: "reamaze_request",
      aliases: ["reamaze.request", "reamaze_request", "reamaze_full_api"],
      capability: "full_api",
      platformCapability: "reamaze_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented API v1 operation on the connected brand's fixed Re:amaze origin. Absolute URLs, credentials, redirects, and version overrides are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: {
            type: "string",
            pattern: "^/api/v1/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$",
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
      id: "reamaze_safe",
      label: "Safe",
      description:
        "Content-free conversation reads and every broader API operation require approval; brand/version binding, Basic-auth secret isolation, user context, bounds, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...full],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected user-authorized operations run without Relay per-action approval; brand/version binding, Basic-auth secret isolation, bounds, audits, and Re:amaze limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...full],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_conversations",
      label:
        "Re:amaze brand, Basic authentication, and bounded conversation-list check",
    },
  ],
};
