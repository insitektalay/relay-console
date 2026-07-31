import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MICROSOFT_LISTS_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "Lists.SelectedOperations.Selected",
];

const reads = [
  action(
    "microsoft_lists_list_get",
    "Read selected list metadata",
    "Read bounded metadata for the connection-bound administrator-granted Microsoft List.",
  ),
  action(
    "microsoft_lists_columns_list",
    "List approved columns",
    "List bounded column metadata only for connection-approved field names.",
  ),
  action(
    "microsoft_lists_items_list",
    "List approved-field items",
    "List at most twenty-five selected-list items containing only connection-approved fields.",
  ),
  action(
    "microsoft_lists_item_get",
    "Read approved-field item",
    "Read one explicit prior-result item containing only connection-approved fields.",
  ),
];

const blockedActions = [
  blocked(
    "microsoft_lists_other_lists_sites",
    "Access other lists or sites",
    "Discovery or access outside the one connection-bound administrator-granted list is outside V1.",
  ),
  blocked(
    "microsoft_lists_unapproved_content",
    "Read unapproved fields or content",
    "Unapproved, hidden, system, person, lookup, and location fields plus attachments, drive content, previews, thumbnails, and versions are outside V1.",
  ),
  blocked(
    "microsoft_lists_identities_permissions",
    "Access identities or permissions",
    "Users, groups, created-by and modified-by identities, permissions, sharing, and analytics are outside V1.",
  ),
  blocked(
    "microsoft_lists_mutation_raw",
    "Change, synchronize, or use raw Lists access",
    "Writes, administration, delta, search, subscriptions, exports, application permissions, arbitrary OData, automatic pagination, beta APIs, and raw Graph access are outside V1.",
  ),
];

const itemIdentifier = {
  type: "string",
  pattern: "^[A-Za-z0-9._!~=-]{1,512}$",
};

export const MICROSOFT_LISTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-lists",
    name: "Microsoft Lists",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://learn.microsoft.com/graph/api/resources/list",
    providerWebsiteUrl:
      "https://www.microsoft.com/microsoft-365/microsoft-lists",
    capabilities: [
      {
        ...capability(
          "selected_list_metadata",
          "Read selected list metadata",
          "Review one administrator-granted list and its approved columns.",
          true,
        ),
        platformCapability: "microsoft_lists_selected_metadata_read",
      },
      {
        ...capability(
          "approved_list_items",
          "Read approved list fields",
          "Review bounded items containing only explicitly approved fields.",
          true,
        ),
        platformCapability: "microsoft_lists_approved_fields_read",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
        tokenUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
        authority: {
          provider: "microsoft",
          defaultMode: "multi_tenant_org",
          tenantIdEnv: "MICROSOFT_TENANT_ID",
        },
        requiredScopes: MICROSOFT_LISTS_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "MICROSOFT_CLIENT_ID",
          label: "Microsoft application client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["oauth"],
          helpText:
            "Relay-owned Entra application ID configured only on Railway.",
        },
        {
          name: "MICROSOFT_CLIENT_SECRET",
          label: "Microsoft application client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["oauth"],
          helpText: "Relay-owned Entra secret retained only by Railway.",
        },
      ],
    },
    tools: [
      {
        name: "microsoft-lists.getList",
        functionName: "microsoft_lists_list_get",
        aliases: ["microsoft-lists.getList", "microsoft_lists_list_get"],
        capability: "selected_list_metadata",
        platformCapability: "microsoft_lists_selected_metadata_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded metadata for the connection-bound administrator-granted list.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-lists.listColumns",
        functionName: "microsoft_lists_columns_list",
        aliases: [
          "microsoft-lists.listColumns",
          "microsoft_lists_columns_list",
        ],
        capability: "selected_list_metadata",
        platformCapability: "microsoft_lists_selected_metadata_read",
        action: "read",
        approvalRequired: false,
        description:
          "List bounded column metadata only for connection-approved field names.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-lists.listItems",
        functionName: "microsoft_lists_items_list",
        aliases: ["microsoft-lists.listItems", "microsoft_lists_items_list"],
        capability: "approved_list_items",
        platformCapability: "microsoft_lists_approved_fields_read",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five items containing only connection-approved fields.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-lists.getItem",
        functionName: "microsoft_lists_item_get",
        aliases: ["microsoft-lists.getItem", "microsoft_lists_item_get"],
        capability: "approved_list_items",
        platformCapability: "microsoft_lists_approved_fields_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read one explicit prior-result item containing only connection-approved fields.",
        inputSchema: {
          type: "object",
          properties: { itemId: itemIdentifier },
          required: ["itemId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_lists_safe",
        label: "Safe",
        description:
          "Four selected-list delegated reads run automatically; other resources, unapproved content, identities, permissions, writes, synchronization, application access, pagination, beta, and raw Graph remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same four selected-list reads run without Relay per-action approval; the administrator grant, approved fields, limits, audit, redaction, and Microsoft controls still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "selected_list",
        label:
          "Microsoft work-account authorization, exact selected-list scope, administrator grant, approved fields, expiry, refresh, and bounded list validation",
        requiredScopes: MICROSOFT_LISTS_SCOPES,
      },
    ],
  };
