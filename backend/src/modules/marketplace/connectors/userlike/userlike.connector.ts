import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "userlike_conversation_list",
    "List conversation metadata",
    "List one fixed first page of content-free Userlike conversation summaries.",
  ),
  action(
    "userlike_conversation_get",
    "Read conversation metadata",
    "Read one exact Userlike conversation through Relay's content-free projection.",
  ),
];
const full = [
  action(
    "userlike_full_api",
    "Use JSON API v3",
    "Use a documented Userlike JSON API v3 operation authorized by the organization token; Safe mode requires approval.",
  ),
];
export const USERLIKE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "userlike",
  name: "Userlike",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.userlike.com/a92a522a3ac940dfa5e5796c246a6842",
  providerWebsiteUrl: "https://www.userlike.com/",
  capabilities: [
    {
      ...capability(
        "conversation_metadata_read",
        "Read conversation operations",
        "List and inspect bounded conversation operational metadata without messages, notes, contacts, names, emails, phones, topics, ratings, surveys, navigation, custom fields, or raw records.",
        true,
      ),
      platformCapability: "userlike_conversation_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Userlike JSON API v3",
        "Use documented fixed-origin JSON API v3 paths and methods allowed by the connected organization token.",
        true,
      ),
      platformCapability: "userlike_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "USERLIKE_ORGANIZATION_TOKEN",
        label: "Userlike organization authentication token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated organization token and, where appropriate, run requests in a least-privileged dedicated operator context.",
      },
    ],
  },
  tools: [
    {
      name: "userlike.listConversations",
      functionName: "userlike_conversation_list",
      aliases: ["userlike.listConversations", "userlike_conversation_list"],
      capability: "conversation_metadata_read",
      platformCapability: "userlike_conversation_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five newest content-free conversation summaries without next-page traversal or raw pagination URLs.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "userlike.getConversation",
      functionName: "userlike_conversation_get",
      aliases: ["userlike.getConversation", "userlike_conversation_get"],
      capability: "conversation_metadata_read",
      platformCapability: "userlike_conversation_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact conversation's ID, status, channel, routing IDs, timestamps, and aggregate counts without content or customer data.",
      inputSchema: {
        type: "object",
        properties: { conversationId: { type: "integer", minimum: 1 } },
        required: ["conversationId"],
        additionalProperties: false,
      },
    },
    {
      name: "userlike.request",
      functionName: "userlike_request",
      aliases: ["userlike.request", "userlike_request", "userlike_full_api"],
      capability: "full_api",
      platformCapability: "userlike_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented JSON API v3 operation on the fixed Userlike origin. Absolute URLs, credentials, redirects, versions, and organization headers are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PATCH", "DELETE"] },
          path: {
            type: "string",
            pattern: "^/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$",
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
      id: "userlike_safe",
      label: "Safe",
      description:
        "Content-free conversation reads and every broader JSON API operation require approval; fixed origin/version, secret isolation, token permissions, bounds, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...full],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected token-authorized operations run without Relay per-action approval; fixed origin/version, secret isolation, bounds, audits, and Userlike limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...full],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_conversations",
      label: "Userlike organization token and bounded conversation-list check",
    },
  ],
};
