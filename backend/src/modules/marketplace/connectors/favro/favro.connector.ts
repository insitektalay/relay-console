import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "favro_organizations_list",
    "List organizations",
    "List at most twenty organization names and IDs visible to the token user.",
  ),
  action(
    "favro_collections_list",
    "List collections",
    "List at most twenty bounded active collections in one exact organization.",
  ),
  action(
    "favro_collection_get",
    "Read collection",
    "Read bounded metadata for one exact collection in one exact organization.",
  ),
  action(
    "favro_widgets_list",
    "List widgets",
    "List at most twenty bounded active boards or backlogs in one exact collection.",
  ),
  action(
    "favro_widget_get",
    "Read widget",
    "Read bounded metadata for one exact board or backlog.",
  ),
  action(
    "favro_cards_list",
    "List cards",
    "List at most twenty metadata-only cards from one exact collection or widget.",
  ),
  action(
    "favro_card_get",
    "Read card",
    "Read bounded metadata for one exact card without descriptions or custom fields.",
  ),
];
const writes = [
  action(
    "favro_card_create",
    "Create card",
    "Create one minimal card with a bounded name on one exact widget.",
  ),
  action(
    "favro_card_update",
    "Rename card",
    "Rename one exact card only after its current name matches.",
  ),
  action(
    "favro_card_delete",
    "Delete card",
    "Delete one exact card instance only after its current name matches.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "favro_organization_admin",
    "Administer organizations",
    "Organization creation, settings, members, roles, groups, domains, SAML, SCIM and billing are unavailable.",
  ),
  blocked(
    "favro_collection_widget_admin",
    "Administer collections or widgets",
    "Collection and widget creation, updates, sharing, permissions, columns, lanes, archival and deletion are unavailable.",
  ),
  blocked(
    "favro_card_advanced",
    "Change advanced card data",
    "Descriptions, custom fields, assignees, dates, tags, task lists, comments, positions, lanes, columns, copies and dependencies are unavailable.",
  ),
  blocked(
    "favro_attachments_webhooks",
    "Manage attachments or webhooks",
    "File upload, attachment mutation and outgoing webhook administration are unavailable.",
  ),
  blocked(
    "favro_raw_api",
    "Run arbitrary Favro calls",
    "Agents cannot choose API origins, paths, routing headers, filters, request bodies or raw REST operations.",
  ),
  blocked(
    "favro_bulk_everywhere",
    "Run bulk or everywhere operations",
    "Bulk mutation and deleting every copy of a card are unavailable; deletion is fixed to everywhere=false.",
  ),
  blocked(
    "favro_unbounded",
    "Export Favro data",
    "First-page twenty-row lists, one exact resource and 256 KiB responses are the maximum supported surface.",
  ),
];
const id = {
  type: "string",
  pattern: "^[A-Za-z0-9_-]{8,64}$",
  minLength: 8,
  maxLength: 64,
};
const limit = { type: "integer", minimum: 1, maximum: 20, default: 10 };
const approvalId = { type: "string", maxLength: 200 };

export const FAVRO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "favro",
  name: "Favro",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://favro.com/developer/",
  providerWebsiteUrl: "https://favro.com/",
  capabilities: [
    {
      ...capability(
        "organization_read",
        "Read organizations",
        "List bounded organization identities visible to the connected user.",
        true,
      ),
      platformCapability: "favro_organization_read",
    },
    {
      ...capability(
        "workspace_read",
        "Read collections and widgets",
        "List and inspect bounded collections, boards and backlogs.",
        true,
      ),
      platformCapability: "favro_workspace_read",
    },
    {
      ...capability(
        "card_read",
        "Read cards",
        "List and inspect metadata-only cards without descriptions or custom fields.",
        true,
      ),
      platformCapability: "favro_card_read",
    },
    {
      ...capability(
        "card_write",
        "Manage cards",
        "Create minimal cards, collision-safely rename them and name-confirm instance deletion.",
        false,
      ),
      platformCapability: "favro_card_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FAVRO_ACCOUNT_EMAIL",
        label: "Favro account email",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The email address of the dedicated least-authority Favro user that created the API token.",
      },
      {
        name: "FAVRO_API_TOKEN",
        label: "Favro API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A separate revocable Favro API token; choose read-only only when card mutations will remain unselected.",
      },
    ],
  },
  tools: [
    {
      name: "favro.listOrganizations",
      functionName: "favro_organizations_list",
      aliases: ["favro.listOrganizations", "favro_organizations_list"],
      description: "List bounded organizations visible to the token user.",
      capability: "organization_read",
      platformCapability: "favro_organization_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { limit, approvalId },
      },
    },
    {
      name: "favro.listCollections",
      functionName: "favro_collections_list",
      aliases: ["favro.listCollections", "favro_collections_list"],
      description: "List bounded active collections in one exact organization.",
      capability: "workspace_read",
      platformCapability: "favro_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId"],
        properties: { organizationId: id, limit, approvalId },
      },
    },
    {
      name: "favro.getCollection",
      functionName: "favro_collection_get",
      aliases: ["favro.getCollection", "favro_collection_get"],
      description: "Read bounded metadata for one exact collection.",
      capability: "workspace_read",
      platformCapability: "favro_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "collectionId"],
        properties: { organizationId: id, collectionId: id, approvalId },
      },
    },
    {
      name: "favro.listWidgets",
      functionName: "favro_widgets_list",
      aliases: ["favro.listWidgets", "favro_widgets_list"],
      description: "List bounded boards and backlogs in one exact collection.",
      capability: "workspace_read",
      platformCapability: "favro_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "collectionId"],
        properties: { organizationId: id, collectionId: id, limit, approvalId },
      },
    },
    {
      name: "favro.getWidget",
      functionName: "favro_widget_get",
      aliases: ["favro.getWidget", "favro_widget_get"],
      description: "Read bounded metadata for one exact board or backlog.",
      capability: "workspace_read",
      platformCapability: "favro_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "widgetCommonId"],
        properties: { organizationId: id, widgetCommonId: id, approvalId },
      },
    },
    {
      name: "favro.listCards",
      functionName: "favro_cards_list",
      aliases: ["favro.listCards", "favro_cards_list"],
      description:
        "List bounded metadata-only cards from one exact collection or widget.",
      capability: "card_read",
      platformCapability: "favro_card_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId"],
        properties: {
          organizationId: id,
          collectionId: id,
          widgetCommonId: id,
          limit,
          approvalId,
        },
        oneOf: [
          { required: ["collectionId"] },
          { required: ["widgetCommonId"] },
        ],
      },
    },
    {
      name: "favro.getCard",
      functionName: "favro_card_get",
      aliases: ["favro.getCard", "favro_card_get"],
      description: "Read bounded metadata for one exact card.",
      capability: "card_read",
      platformCapability: "favro_card_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "cardId"],
        properties: { organizationId: id, cardId: id, approvalId },
      },
    },
    {
      name: "favro.createCard",
      functionName: "favro_card_create",
      aliases: ["favro.createCard", "favro_card_create"],
      description: "Create one minimal named card on one exact widget.",
      capability: "card_write",
      platformCapability: "favro_card_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "widgetCommonId", "name"],
        properties: {
          organizationId: id,
          widgetCommonId: id,
          name: { type: "string", minLength: 1, maxLength: 200 },
          approvalId,
        },
      },
    },
    {
      name: "favro.updateCard",
      functionName: "favro_card_update",
      aliases: ["favro.updateCard", "favro_card_update"],
      description: "Rename one exact card after checking its current name.",
      capability: "card_write",
      platformCapability: "favro_card_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "cardId", "expectedName", "name"],
        properties: {
          organizationId: id,
          cardId: id,
          expectedName: { type: "string", minLength: 1, maxLength: 200 },
          name: { type: "string", minLength: 1, maxLength: 200 },
          approvalId,
        },
      },
    },
    {
      name: "favro.deleteCard",
      functionName: "favro_card_delete",
      aliases: ["favro.deleteCard", "favro_card_delete"],
      description:
        "Delete one exact card instance after checking its current name.",
      capability: "card_write",
      platformCapability: "favro_card_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "cardId", "expectedName"],
        properties: {
          organizationId: id,
          cardId: id,
          expectedName: { type: "string", minLength: 1, maxLength: 200 },
          approvalId,
        },
      },
    },
  ],
  approvalProfiles: [
    {
      id: "favro_safe",
      label: "Safe",
      description:
        "Private reads and every card mutation require approval. Fixed origin, inherited user authority, exact IDs, bounds, confirmation and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: allActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All ten selected Favro actions run without Relay per-action approval; token authority, exact IDs, bounds, field allowlists, confirmation, redaction and audits still apply.",
      defaultSelected: false,
      allowedActions: allActions,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [{ id: "favro-token", label: "Favro API token" }],
};
