import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MIRO_SCOPES = ["boards:read", "boards:write"];

const reads = [
  action(
    "miro_board_list",
    "List boards",
    "List one bounded page of boards visible to the connected Miro user.",
  ),
  action(
    "miro_board_get",
    "Read board",
    "Read useful metadata for one explicit Miro board.",
  ),
  action(
    "miro_board_items",
    "List board items",
    "List one cursor-bounded page of typed items from one explicit board.",
  ),
  action(
    "miro_item_get",
    "Read board item",
    "Read one explicit item with its content and spatial context.",
  ),
  action(
    "miro_item_prepare",
    "Prepare item change",
    "Normalize and hash one sticky-note, card, or supported-item change locally.",
  ),
];
const writes = [
  action(
    "miro_sticky_note_create",
    "Create sticky note",
    "Create one bounded sticky note on one explicit board.",
  ),
  action(
    "miro_card_create",
    "Create card",
    "Create one bounded card on one explicit board.",
  ),
  action(
    "miro_item_update",
    "Update supported item",
    "Update one explicit sticky note, card, text, or shape.",
  ),
];
const blockedActions = [
  blocked(
    "miro_item_delete",
    "Delete board content",
    "Deletion and bulk destructive operations are outside V1.",
  ),
  blocked(
    "miro_board_admin",
    "Administer boards or teams",
    "Board creation, sharing, membership, organization, project, team, and enterprise administration are outside V1.",
  ),
  blocked(
    "miro_extended_mutation",
    "Change extended board resources",
    "Connectors, tags, app cards, documents, embeds, images, webhooks, and external-resource mutations are outside V1.",
  ),
  blocked(
    "miro_binary_broad_raw",
    "Transfer or crawl broad content",
    "Binary transfer, automatic pagination, broad ingestion, exports, and arbitrary REST calls are outside V1.",
  ),
];

export const MIRO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "miro",
  name: "Miro",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.miro.com/reference/",
  providerWebsiteUrl: "https://miro.com/",
  capabilities: [
    {
      ...capability(
        "board_read",
        "Read boards",
        "List bounded boards and inspect useful metadata for one explicit board.",
        true,
      ),
      platformCapability: "miro_board_read",
    },
    {
      ...capability(
        "item_read",
        "Read board items",
        "Inspect bounded cursor-paginated items with type, content, style, position, geometry, parent, creator, and timestamps.",
        true,
      ),
      platformCapability: "miro_item_read",
    },
    {
      ...capability(
        "item_draft",
        "Prepare board changes",
        "Normalize and hash exact item changes locally before any provider mutation.",
        true,
      ),
      platformCapability: "miro_item_draft",
    },
    {
      ...capability(
        "item_write",
        "Create and update items",
        "Create sticky notes or cards and update supported explicit items.",
        true,
      ),
      platformCapability: "miro_item_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://miro.com/oauth/authorize",
      tokenUrl: "https://api.miro.com/v1/oauth/token",
      refreshUrl: "https://api.miro.com/v1/oauth/token",
      revocationUrl: "https://api.miro.com/v2/oauth/revoke",
      requiredScopes: MIRO_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MIRO_CLIENT_ID",
        label: "Miro client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Miro OAuth client ID.",
      },
      {
        name: "MIRO_CLIENT_SECRET",
        label: "Miro client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Miro client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    tool(
      "miro.listBoards",
      "miro_board_list",
      "board_read",
      "read",
      false,
      "List at most fifty boards without following pagination.",
      {
        teamId: identifier(false),
        projectId: identifier(false),
        query: text(1, 500),
        ownerId: identifier(false),
        maxResults: integer(1, 50),
        offset: integer(0, 9950),
        sort: {
          type: "string",
          enum: [
            "default",
            "last_modified",
            "last_opened",
            "last_created",
            "alphabetically",
          ],
        },
      },
    ),
    tool(
      "miro.getBoard",
      "miro_board_get",
      "board_read",
      "read",
      false,
      "Read useful metadata for one explicit board.",
      { boardId: identifier() },
      ["boardId"],
    ),
    tool(
      "miro.listBoardItems",
      "miro_board_items",
      "item_read",
      "read",
      false,
      "List at most fifty typed items from one board cursor page.",
      {
        boardId: identifier(),
        itemType: {
          type: "string",
          enum: [
            "app_card",
            "card",
            "document",
            "embed",
            "frame",
            "image",
            "shape",
            "sticky_note",
            "text",
          ],
        },
        parentItemId: identifier(false),
        maxResults: integer(10, 50),
        cursor: text(1, 2000),
      },
      ["boardId"],
    ),
    tool(
      "miro.getBoardItem",
      "miro_item_get",
      "item_read",
      "read",
      false,
      "Read one explicit board item with useful spatial semantics.",
      { boardId: identifier(), itemId: identifier() },
      ["boardId", "itemId"],
    ),
    tool(
      "miro.prepareItemChange",
      "miro_item_prepare",
      "item_draft",
      "draft",
      false,
      "Prepare and hash a sticky-note, card, or supported-item change locally.",
      changeFields(false),
      ["operation", "boardId", "content"],
    ),
    tool(
      "miro.createStickyNote",
      "miro_sticky_note_create",
      "item_write",
      "write",
      true,
      "Create one bounded sticky note on one explicit board.",
      writeFields(changeFields(false)),
      ["boardId", "content", "approvalId", "idempotencyKey"],
    ),
    tool(
      "miro.createCard",
      "miro_card_create",
      "item_write",
      "write",
      true,
      "Create one bounded card on one explicit board.",
      writeFields(changeFields(false)),
      ["boardId", "content", "approvalId", "idempotencyKey"],
    ),
    tool(
      "miro.updateItem",
      "miro_item_update",
      "item_write",
      "write",
      true,
      "Update one explicit sticky note, card, text, or shape.",
      writeFields(changeFields(true)),
      [
        "boardId",
        "itemId",
        "itemType",
        "content",
        "approvalId",
        "idempotencyKey",
      ],
    ),
  ],
  approvalProfiles: [
    {
      id: "miro_safe",
      label: "Safe",
      description:
        "Bounded board and item reads plus local drafts run directly; every Miro mutation requires matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Miro operation supported by this connector runs without Relay per-action approval; connection ownership, OAuth grants, fixed routes, bounds, audits, redaction, idempotency, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "boards",
      label: "Connected Miro user, team, and board access",
      requiredScopes: ["boards:read"],
    },
  ],
};

function tool(
  name: string,
  alias: string,
  capabilityId: string,
  actionName: "read" | "draft" | "write",
  approvalRequired: boolean,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) {
  return {
    name,
    functionName: alias,
    aliases: [name, alias],
    capability: capabilityId,
    platformCapability: `miro_${capabilityId}`,
    action: actionName,
    approvalRequired,
    description,
    inputSchema: {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
  };
}
function text(minLength: number, maxLength: number) {
  return { type: "string", minLength, maxLength };
}
function integer(minimum: number, maximum: number) {
  return { type: "integer", minimum, maximum };
}
function number(minimum: number, maximum: number) {
  return { type: "number", minimum, maximum };
}
function identifier(required = true) {
  return required ? text(1, 500) : text(0, 500);
}
function changeFields(update: boolean) {
  return {
    operation: { type: "string", enum: ["sticky_note", "card", "update"] },
    boardId: identifier(),
    ...(update
      ? {
          itemId: identifier(),
          itemType: {
            type: "string",
            enum: ["sticky_note", "card", "text", "shape"],
          },
        }
      : {}),
    content: text(1, 5000),
    title: text(1, 255),
    x: number(-1000000, 1000000),
    y: number(-1000000, 1000000),
    width: number(1, 50000),
    height: number(1, 50000),
    parentId: identifier(false),
  };
}
function writeFields(fields: Record<string, unknown>) {
  return { ...fields, approvalId: text(1, 200), idempotencyKey: text(1, 180) };
}
