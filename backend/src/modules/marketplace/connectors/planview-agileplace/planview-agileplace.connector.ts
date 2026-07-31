import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "planview_agileplace_boards_list",
    "List boards",
    "List at most twenty bounded board summaries visible to the token user.",
  ),
  action(
    "planview_agileplace_board_get",
    "Read board",
    "Read bounded metadata for one exact AgilePlace board.",
  ),
  action(
    "planview_agileplace_cards_list",
    "List cards",
    "List at most twenty metadata-only cards from one exact board.",
  ),
  action(
    "planview_agileplace_card_get",
    "Read card",
    "Read bounded metadata for one exact AgilePlace card.",
  ),
];
const writes = [
  action(
    "planview_agileplace_card_create",
    "Create card",
    "Create one minimal card with a bounded title on one exact board.",
  ),
  action(
    "planview_agileplace_card_update",
    "Rename card",
    "Rename one exact card after its title and resource version both match.",
  ),
  action(
    "planview_agileplace_card_delete",
    "Delete card",
    "Delete one exact card after its title and resource version both match.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "planview_agileplace_account_admin",
    "Administer account or users",
    "Account settings, users, teams, roles, invitations, SSO, SCIM, tokens and billing are unavailable.",
  ),
  blocked(
    "planview_agileplace_board_admin",
    "Administer boards",
    "Board creation, deletion, archival, layout, roles, members, filters, templates and WIP settings are unavailable.",
  ),
  blocked(
    "planview_agileplace_card_advanced",
    "Change advanced card data",
    "Descriptions, assignments, custom fields, links, tags, dates, type, lane, dependencies, connections and task cards are unavailable.",
  ),
  blocked(
    "planview_agileplace_attachments_comments",
    "Change attachments or comments",
    "Attachment content and comment creation, update, deletion or export are unavailable.",
  ),
  blocked(
    "planview_agileplace_automation_reporting",
    "Use automation or reporting APIs",
    "Automations, custom events, planning series, advanced reporting, OData and user provisioning are outside this connection.",
  ),
  blocked(
    "planview_agileplace_raw_api",
    "Run arbitrary AgilePlace calls",
    "Agents cannot choose tenant origins, paths, query parameters, fields, JSON Patch operations or raw REST requests.",
  ),
  blocked(
    "planview_agileplace_bulk_unbounded",
    "Run bulk or unbounded operations",
    "Bulk mutation, cross-board search, exports and responses above twenty rows or 256 KiB are unavailable.",
  ),
];
const id = {
  type: "string",
  pattern: "^[0-9]{1,20}$",
  minLength: 1,
  maxLength: 20,
};
const limit = { type: "integer", minimum: 1, maximum: 20, default: 10 };
const approvalId = { type: "string", maxLength: 200 };

export const PLANVIEW_AGILEPLACE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "planview-agileplace",
  name: "Planview AgilePlace",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://success.planview.com/Planview_AgilePlace/AgilePlace_API",
  providerWebsiteUrl:
    "https://www.planview.com/products-solutions/products/agileplace/",
  capabilities: [
    {
      ...capability(
        "board_read",
        "Read boards",
        "List bounded visible boards and inspect one exact board.",
        true,
      ),
      platformCapability: "planview_agileplace_board_read",
    },
    {
      ...capability(
        "card_read",
        "Read cards",
        "List and inspect bounded card metadata without descriptions or identities.",
        true,
      ),
      platformCapability: "planview_agileplace_card_read",
    },
    {
      ...capability(
        "card_write",
        "Manage cards",
        "Create minimal cards and version-check rename or deletion.",
        false,
      ),
      platformCapability: "planview_agileplace_card_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PLANVIEW_AGILEPLACE_API_TOKEN",
        label: "AgilePlace API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A separate bearer token created by the intended least-authority AgilePlace user and revoked when Relay is disconnected.",
      },
      {
        name: "PLANVIEW_AGILEPLACE_ACCOUNT_HOSTNAME",
        label: "AgilePlace account hostname",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact tenant hostname, such as example.leankit.com; Relay rejects every other host.",
      },
    ],
  },
  tools: [
    {
      name: "planviewAgilePlace.listBoards",
      functionName: "planview_agileplace_boards_list",
      aliases: [
        "planviewAgilePlace.listBoards",
        "planview_agileplace_boards_list",
      ],
      description: "List bounded boards visible to the token user.",
      capability: "board_read",
      platformCapability: "planview_agileplace_board_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          keyword: { type: "string", minLength: 1, maxLength: 80 },
          limit,
          approvalId,
        },
      },
    },
    {
      name: "planviewAgilePlace.getBoard",
      functionName: "planview_agileplace_board_get",
      aliases: [
        "planviewAgilePlace.getBoard",
        "planview_agileplace_board_get",
      ],
      description: "Read bounded metadata for one exact board.",
      capability: "board_read",
      platformCapability: "planview_agileplace_board_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["boardId"],
        properties: { boardId: id, approvalId },
      },
    },
    {
      name: "planviewAgilePlace.listCards",
      functionName: "planview_agileplace_cards_list",
      aliases: [
        "planviewAgilePlace.listCards",
        "planview_agileplace_cards_list",
      ],
      description: "List bounded metadata-only cards from one exact board.",
      capability: "card_read",
      platformCapability: "planview_agileplace_card_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["boardId"],
        properties: {
          boardId: id,
          keyword: { type: "string", minLength: 1, maxLength: 80 },
          limit,
          approvalId,
        },
      },
    },
    {
      name: "planviewAgilePlace.getCard",
      functionName: "planview_agileplace_card_get",
      aliases: [
        "planviewAgilePlace.getCard",
        "planview_agileplace_card_get",
      ],
      description: "Read bounded metadata for one exact card.",
      capability: "card_read",
      platformCapability: "planview_agileplace_card_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["cardId"],
        properties: { cardId: id, approvalId },
      },
    },
    {
      name: "planviewAgilePlace.createCard",
      functionName: "planview_agileplace_card_create",
      aliases: [
        "planviewAgilePlace.createCard",
        "planview_agileplace_card_create",
      ],
      description: "Create one minimal card on one exact board.",
      capability: "card_write",
      platformCapability: "planview_agileplace_card_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["boardId", "title"],
        properties: {
          boardId: id,
          title: { type: "string", minLength: 1, maxLength: 200 },
          approvalId,
        },
      },
    },
    {
      name: "planviewAgilePlace.updateCard",
      functionName: "planview_agileplace_card_update",
      aliases: [
        "planviewAgilePlace.updateCard",
        "planview_agileplace_card_update",
      ],
      description: "Rename one exact card after title and version checks.",
      capability: "card_write",
      platformCapability: "planview_agileplace_card_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["cardId", "expectedTitle", "expectedVersion", "title"],
        properties: {
          cardId: id,
          expectedTitle: { type: "string", minLength: 1, maxLength: 200 },
          expectedVersion: id,
          title: { type: "string", minLength: 1, maxLength: 200 },
          approvalId,
        },
      },
    },
    {
      name: "planviewAgilePlace.deleteCard",
      functionName: "planview_agileplace_card_delete",
      aliases: [
        "planviewAgilePlace.deleteCard",
        "planview_agileplace_card_delete",
      ],
      description: "Delete one exact card after title and version checks.",
      capability: "card_write",
      platformCapability: "planview_agileplace_card_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["cardId", "expectedTitle", "expectedVersion"],
        properties: {
          cardId: id,
          expectedTitle: { type: "string", minLength: 1, maxLength: 200 },
          expectedVersion: id,
          approvalId,
        },
      },
    },
  ],
  approvalProfiles: [
    {
      id: "planview_agileplace_safe",
      label: "Safe",
      description:
        "Private reads and every card mutation require approval. Tenant binding, token-user authority, bounds, field allowlists, version checks and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: allActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All seven selected AgilePlace actions run without Relay per-action approval; tenant binding, token authority, bounds, field allowlists, version checks, redaction and audits still apply.",
      defaultSelected: false,
      allowedActions: allActions,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "boards",
      label: "API token, tenant hostname and visible-board validation",
    },
  ],
};
