import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "notion_content_search",
    "Search content",
    "Search a bounded set of accessible Notion pages and data sources.",
  ),
  action(
    "notion_page_read",
    "Read a page",
    "Read one explicit accessible Notion page.",
  ),
  action(
    "notion_block_children_read",
    "Read page content",
    "Read one bounded child-block list without automatic recursion.",
  ),
  action(
    "notion_content_update_prepare",
    "Prepare an update",
    "Prepare an exact page or block payload locally without changing Notion.",
  ),
];
const writes = [
  action(
    "notion_page_create",
    "Create a page",
    "Create one exact page under an explicit shared parent.",
  ),
  action(
    "notion_block_children_append",
    "Append content",
    "Append an exact bounded block list to one explicit parent.",
  ),
];
const blockedActions = [
  blocked(
    "notion_share_admin",
    "Change sharing",
    "Workspace membership, sharing, public publishing, and connection capability administration are outside V1.",
  ),
  blocked(
    "notion_schema_admin",
    "Change schemas",
    "Database and data-source schema changes are outside V1.",
  ),
  blocked(
    "notion_destructive_write",
    "Delete or archive content",
    "Deleting, archiving, restoring, moving, or bulk-changing content is outside V1.",
  ),
  blocked(
    "notion_raw_api",
    "Use arbitrary Notion API calls",
    "Raw URLs, arbitrary operations, credentials, unbounded traversal, and hidden-content inference are never exposed.",
  ),
];

export const NOTION_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "notion",
  name: "Notion",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.notion.com/",
  providerWebsiteUrl: "https://www.notion.so/",
  capabilities: [
    {
      ...capability(
        "content_search",
        "Find content",
        "Search bounded pages and data sources shared with the connection.",
        true,
      ),
      platformCapability: "notion_content_search",
    },
    {
      ...capability(
        "page_read",
        "Read pages",
        "Read one explicit Notion page.",
        true,
      ),
      platformCapability: "notion_page_read",
    },
    {
      ...capability(
        "block_read",
        "Read page content",
        "Read one bounded child-block list.",
        true,
      ),
      platformCapability: "notion_block_read",
    },
    {
      ...capability(
        "content_draft",
        "Prepare updates",
        "Prepare exact Notion payloads locally.",
        true,
      ),
      platformCapability: "notion_content_draft",
    },
    {
      ...capability(
        "page_write",
        "Create pages",
        "Create one page under an explicit shared parent.",
        true,
      ),
      platformCapability: "notion_page_write",
    },
    {
      ...capability(
        "block_write",
        "Append content",
        "Append bounded blocks to one explicit shared parent.",
        true,
      ),
      platformCapability: "notion_block_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
      tokenUrl: "https://api.notion.com/v1/oauth/token",
      refreshUrl: "https://api.notion.com/v1/oauth/token",
      revocationUrl: "https://api.notion.com/v1/oauth/revoke",
      userInfoUrl: "https://api.notion.com/v1/users/me",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "NOTION_CLIENT_ID",
        label: "Notion OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console public Notion connection ID.",
      },
      {
        name: "NOTION_CLIENT_SECRET",
        label: "Notion OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Notion client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_notion_search",
      functionName: "relay_notion_search",
      aliases: ["notion_content_search"],
      capability: "content_search",
      platformCapability: "notion_content_search",
      action: "read",
      approvalRequired: false,
      description:
        "Search at most twenty-five accessible Notion pages and data sources.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", maxLength: 256 },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "relay_notion_get_page",
      functionName: "relay_notion_get_page",
      aliases: ["notion_page_read"],
      capability: "page_read",
      platformCapability: "notion_page_read",
      action: "read",
      approvalRequired: false,
      description: "Read one explicit Notion page.",
      inputSchema: {
        type: "object",
        properties: {
          pageId: { type: "string", minLength: 32, maxLength: 36 },
        },
        required: ["pageId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_notion_get_block_children",
      functionName: "relay_notion_get_block_children",
      aliases: ["notion_block_children_read"],
      capability: "block_read",
      platformCapability: "notion_block_read",
      action: "read",
      approvalRequired: false,
      description: "Read at most fifty direct children of one page or block.",
      inputSchema: {
        type: "object",
        properties: {
          blockId: { type: "string", minLength: 32, maxLength: 36 },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["blockId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_notion_draft_update",
      functionName: "relay_notion_draft_update",
      aliases: ["notion_content_update_prepare"],
      capability: "content_draft",
      platformCapability: "notion_content_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare a bounded Notion payload locally without changing Notion.",
      inputSchema: {
        type: "object",
        properties: {
          parentId: { type: "string", minLength: 32, maxLength: 36 },
          target: { type: "string", enum: ["page", "block"] },
          payload: { type: "object" },
        },
        required: ["parentId", "target", "payload"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_notion_create_page",
      functionName: "relay_notion_create_page",
      aliases: ["notion_page_create"],
      capability: "page_write",
      platformCapability: "notion_page_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one page under an explicit shared page or data source.",
      inputSchema: {
        type: "object",
        properties: {
          parentType: { type: "string", enum: ["page_id", "data_source_id"] },
          parentId: { type: "string", minLength: 32, maxLength: 36 },
          titlePropertyName: { type: "string", minLength: 1, maxLength: 200 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          children: { type: "array", maxItems: 50 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["parentType", "parentId", "title", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_notion_append_blocks",
      functionName: "relay_notion_append_blocks",
      aliases: ["notion_block_children_append"],
      capability: "block_write",
      platformCapability: "notion_block_write",
      action: "write",
      approvalRequired: true,
      description: "Append at most fifty blocks to one explicit page or block.",
      inputSchema: {
        type: "object",
        properties: {
          blockId: { type: "string", minLength: 32, maxLength: 36 },
          children: { type: "array", minItems: 1, maxItems: 50 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["blockId", "children", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "notion_safe",
      label: "Safe",
      description:
        "Bounded reads and drafts run directly; each write requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDrafts,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected supported Notion operation runs without Relay per-action approval; provider-granted access and safety bounds still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "notion_bot", label: "Notion connected-workspace authorization" },
  ],
};
