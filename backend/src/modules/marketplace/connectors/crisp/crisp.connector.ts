import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const conversationReads = [
  action(
    "crisp_conversation_list",
    "List conversation metadata",
    "List one fixed first page of content-free Crisp conversation operational summaries.",
  ),
  action(
    "crisp_conversation_state_get",
    "Read conversation state",
    "Read the state of one exact Crisp conversation without messages or customer metadata.",
  ),
];
const fullApi = [
  action(
    "crisp_full_api",
    "Use REST API v1",
    "Use a documented Crisp website REST API v1 operation authorized by the connected website token; Safe mode requires approval.",
  ),
];

export const CRISP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "crisp",
  name: "Crisp",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.crisp.chat/references/rest-api/v1/",
  providerWebsiteUrl: "https://crisp.chat/",
  capabilities: [
    {
      ...capability(
        "conversation_metadata_read",
        "Read conversation operations",
        "List bounded conversation operational metadata and read exact state without messages, previews, topics, people IDs, customer metadata, contact details, device/location data, compose contents, participants, mentions, segments, or attachments.",
        true,
      ),
      platformCapability: "crisp_conversation_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Crisp REST API v1",
        "Use documented website-relative REST API v1 paths and methods allowed by the connected website token.",
        true,
      ),
      platformCapability: "crisp_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CRISP_WEBSITE_ID",
        label: "Crisp website identifier",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the workspace website identifier paired with the website token.",
      },
      {
        name: "CRISP_TOKEN_IDENTIFIER",
        label: "Crisp website token identifier",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the identifier from a customer-generated single-workspace website token.",
      },
      {
        name: "CRISP_TOKEN_KEY",
        label: "Crisp website token key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter the secret key from the same website token keypair.",
      },
    ],
  },
  tools: [
    {
      name: "crisp.listConversations",
      functionName: "crisp_conversation_list",
      aliases: ["crisp.listConversations", "crisp_conversation_list"],
      capability: "conversation_metadata_read",
      platformCapability: "crisp_conversation_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List twenty to twenty-five first-page conversation operational summaries without content, customer/contact metadata, device/location data, or raw records.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 20, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "crisp.getConversationState",
      functionName: "crisp_conversation_state_get",
      aliases: ["crisp.getConversationState", "crisp_conversation_state_get"],
      capability: "conversation_metadata_read",
      platformCapability: "crisp_conversation_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read only the provider state of one exact conversation without messages, metadata, routing identities, or customer data.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", minLength: 1, maxLength: 128 },
        },
        required: ["sessionId"],
        additionalProperties: false,
      },
    },
    {
      name: "crisp.request",
      functionName: "crisp_request",
      aliases: ["crisp.request", "crisp_request", "crisp_full_api"],
      capability: "full_api",
      platformCapability: "crisp_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented website-relative REST API v1 operation on the fixed Crisp origin. Absolute URLs, credentials, redirects, and version/website overrides are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
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
      id: "crisp_safe",
      label: "Safe",
      description:
        "Content-free conversation reads and every broader REST API operation require approval; fixed origin/version/website binding, secret isolation, provider token authorization, and bounds remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...conversationReads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected token-authorized operations run without Relay per-action approval; fixed origin/version/website binding, secret isolation, bounds, audits, provider authorization, and Crisp quotas still apply.",
      defaultSelected: false,
      allowedActions: [...conversationReads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_conversations",
      label:
        "Crisp website identifier, token keypair, and bounded conversation-list check",
    },
  ],
};
