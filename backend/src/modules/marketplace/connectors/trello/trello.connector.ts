import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "trello_board_list",
    "List boards",
    "List a bounded set of boards available to the connected member.",
  ),
  action(
    "trello_board_cards_list",
    "List board cards",
    "List a bounded set of open cards on one explicit board.",
  ),
  action(
    "trello_card_get",
    "Read a card",
    "Read one explicit card with bounded comments and member context.",
  ),
  action(
    "trello_search",
    "Find cards",
    "Find a bounded set of cards matching an explicit query.",
  ),
  action(
    "trello_card_prepare",
    "Prepare a card change",
    "Prepare and hash one card create, update, or comment locally.",
  ),
];
const writes = [
  action(
    "trello_card_create",
    "Create a card",
    "Create one card in an explicit list.",
  ),
  action(
    "trello_card_update",
    "Update a card",
    "Update bounded fields on one explicit card.",
  ),
  action(
    "trello_card_comment_create",
    "Comment on a card",
    "Add one bounded comment to an explicit card.",
  ),
];
const blockedActions = [
  blocked(
    "trello_admin",
    "Administer Trello",
    "Workspace, member, Power-Up, webhook, enterprise, and billing administration are outside V1.",
  ),
  blocked(
    "trello_destructive",
    "Delete Trello data",
    "Board, list, card, checklist, label, and comment deletion are outside V1.",
  ),
  blocked(
    "trello_raw_api",
    "Call arbitrary Trello endpoints",
    "Raw paths, batch requests, unbounded pagination, and arbitrary REST calls are never exposed.",
  ),
];

export const TRELLO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "trello",
  name: "Trello",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.atlassian.com/cloud/trello/rest/",
  providerWebsiteUrl: "https://trello.com/",
  capabilities: [
    {
      ...capability(
        "board_read",
        "View boards",
        "List bounded boards available to the connected member.",
        true,
      ),
      platformCapability: "trello_board_read",
    },
    {
      ...capability(
        "card_read",
        "Find and read cards",
        "Find bounded cards and read one explicit card.",
        true,
      ),
      platformCapability: "trello_card_read",
    },
    {
      ...capability(
        "card_draft",
        "Prepare card changes",
        "Prepare an exact card create, update, or comment locally.",
        true,
      ),
      platformCapability: "trello_card_draft",
    },
    {
      ...capability(
        "card_write",
        "Create, update, and comment",
        "Create or update one card and add one comment.",
        true,
      ),
      platformCapability: "trello_card_write",
    },
  ],
  auth: {
    type: "oauth1",
    oauth: {
      authorizationUrl: "https://trello.com/1/OAuthAuthorizeToken",
      tokenUrl: "https://trello.com/1/OAuthGetAccessToken",
      revocationUrl: "https://api.trello.com/1/tokens/{token}",
      userInfoUrl: "https://api.trello.com/1/members/me",
      requiredScopes: ["read", "write"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "TRELLO_API_KEY",
        label: "Trello Power-Up API key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Trello Power-Up API key.",
      },
      {
        name: "TRELLO_API_SECRET",
        label: "Trello Power-Up API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held OAuth 1.0 signing secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_trello_list_boards",
      functionName: "relay_trello_list_boards",
      aliases: ["trello_board_list"],
      capability: "board_read",
      platformCapability: "trello_board_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Trello boards for the connected member.",
      inputSchema: {
        type: "object",
        properties: {
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "relay_trello_list_board_cards",
      functionName: "relay_trello_list_board_cards",
      aliases: ["trello_board_cards_list"],
      capability: "card_read",
      platformCapability: "trello_card_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five open cards on one explicit Trello board.",
      inputSchema: {
        type: "object",
        properties: {
          boardId: { type: "string", minLength: 1, maxLength: 100 },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["boardId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_trello_get_card",
      functionName: "relay_trello_get_card",
      aliases: ["trello_card_get"],
      capability: "card_read",
      platformCapability: "trello_card_read",
      action: "read",
      approvalRequired: false,
      description: "Read one Trello card with at most ten comments.",
      inputSchema: {
        type: "object",
        properties: {
          cardId: { type: "string", minLength: 1, maxLength: 100 },
          maxDescriptionChars: { type: "integer", minimum: 1, maximum: 4000 },
        },
        required: ["cardId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_trello_search_cards",
      functionName: "relay_trello_search_cards",
      aliases: ["trello_search"],
      capability: "card_read",
      platformCapability: "trello_card_read",
      action: "read",
      approvalRequired: false,
      description:
        "Find at most twenty-five Trello cards matching an explicit query.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 200 },
          boardId: { type: "string", maxLength: 100 },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_trello_draft_card_change",
      functionName: "relay_trello_draft_card_change",
      aliases: ["trello_card_prepare"],
      capability: "card_draft",
      platformCapability: "trello_card_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare one bounded card create, update, or comment locally.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["create", "update", "comment"] },
          cardId: { type: "string", maxLength: 100 },
          fields: { type: "object" },
        },
        required: ["operation", "fields"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_trello_create_card",
      functionName: "relay_trello_create_card",
      aliases: ["trello_card_create"],
      capability: "card_write",
      platformCapability: "trello_card_write",
      action: "write",
      approvalRequired: true,
      description: "Create one card in an explicit Trello list.",
      inputSchema: {
        type: "object",
        properties: {
          listId: { type: "string", minLength: 1, maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          description: { type: "string", maxLength: 16000 },
          due: { type: "string", maxLength: 40 },
          dueComplete: { type: "boolean" },
          memberIds: {
            type: "array",
            maxItems: 50,
            items: { type: "string", maxLength: 100 },
          },
          labelIds: {
            type: "array",
            maxItems: 50,
            items: { type: "string", maxLength: 100 },
          },
          position: {
            oneOf: [
              { type: "string", enum: ["top", "bottom"] },
              { type: "number" },
            ],
          },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["listId", "name", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_trello_update_card",
      functionName: "relay_trello_update_card",
      aliases: ["trello_card_update"],
      capability: "card_write",
      platformCapability: "trello_card_write",
      action: "write",
      approvalRequired: true,
      description: "Update bounded fields on one explicit Trello card.",
      inputSchema: {
        type: "object",
        properties: {
          cardId: { type: "string", minLength: 1, maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          description: { type: "string", maxLength: 16000 },
          listId: { type: "string", maxLength: 100 },
          closed: { type: "boolean" },
          due: { type: "string", maxLength: 40 },
          dueComplete: { type: "boolean" },
          position: {
            oneOf: [
              { type: "string", enum: ["top", "bottom"] },
              { type: "number" },
            ],
          },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["cardId", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_trello_add_comment",
      functionName: "relay_trello_add_comment",
      aliases: ["trello_card_comment_create"],
      capability: "card_write",
      platformCapability: "trello_card_write",
      action: "write",
      approvalRequired: true,
      description: "Add one bounded comment to an explicit Trello card.",
      inputSchema: {
        type: "object",
        properties: {
          cardId: { type: "string", minLength: 1, maxLength: 100 },
          text: { type: "string", minLength: 1, maxLength: 4000 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["cardId", "text", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "trello_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; each Trello card write requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDrafts,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected supported Trello operation runs without Relay per-action approval; provider-granted access and safety bounds still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "trello_me",
      label: "Trello member and Workspace authorization",
      requiredScopes: ["read", "write"],
    },
  ],
};
