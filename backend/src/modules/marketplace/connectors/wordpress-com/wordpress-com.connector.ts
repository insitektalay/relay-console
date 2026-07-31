import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const WORDPRESS_COM_SCOPES = ["sites", "posts"];

const reads = [
  action(
    "wordpress_com_site_list",
    "List authorized sites",
    "List the bounded WordPress.com or Jetpack sites visible to the specific-blog grant.",
  ),
  action(
    "wordpress_com_site_get",
    "Read site",
    "Read identity, URL, visibility, capabilities, and useful settings for the authorized site.",
  ),
  action(
    "wordpress_com_post_list",
    "List posts",
    "List one bounded page of posts for the authorized site.",
  ),
  action(
    "wordpress_com_post_get",
    "Read post",
    "Read one explicit post with bounded editor content and version metadata.",
  ),
  action(
    "wordpress_com_post_prepare",
    "Prepare post change",
    "Normalize and hash one draft creation, draft update, or publication locally.",
  ),
];
const writes = [
  action(
    "wordpress_com_post_create_draft",
    "Create draft",
    "Create one post with provider status forced to draft and public sharing disabled.",
  ),
  action(
    "wordpress_com_post_update_draft",
    "Update draft",
    "Update explicit fields on one draft after confirming its expected modified time.",
  ),
  action(
    "wordpress_com_post_publish",
    "Publish post",
    "Publish one explicit reviewed draft after confirming its expected modified time.",
  ),
];
const blockedActions = [
  blocked(
    "wordpress_com_delete_restore",
    "Delete or restore content",
    "Trash, permanent deletion, restore, and bulk mutation are outside V1.",
  ),
  blocked(
    "wordpress_com_media_admin",
    "Upload media or administer sites",
    "Media transfer, comments, taxonomy creation, users, plugins, themes, menus, settings, and site administration are outside V1.",
  ),
  blocked(
    "wordpress_com_global_raw",
    "Use global or arbitrary access",
    "Global scope, batch calls, Reader and social actions, automatic pagination, broad ingestion, arbitrary namespaces, and raw provider calls are outside V1.",
  ),
];

export const WORDPRESS_COM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "wordpress-com",
  name: "WordPress.com",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.wordpress.com/docs/api/",
  providerWebsiteUrl: "https://wordpress.com/",
  capabilities: [
    {
      ...capability(
        "site_read",
        "Read authorized site",
        "List and inspect the specific WordPress.com or Jetpack site granted by the user.",
        true,
      ),
      platformCapability: "wordpress_com_site_read",
    },
    {
      ...capability(
        "post_read",
        "Read posts",
        "List one bounded post page and inspect one explicit post with editor metadata.",
        true,
      ),
      platformCapability: "wordpress_com_post_read",
    },
    {
      ...capability(
        "post_draft",
        "Prepare and create drafts",
        "Prepare exact changes locally and create one post forced to draft.",
        true,
      ),
      platformCapability: "wordpress_com_post_draft",
    },
    {
      ...capability(
        "post_update",
        "Update drafts",
        "Update one explicit draft after a stale-version check.",
        true,
      ),
      platformCapability: "wordpress_com_post_update",
    },
    {
      ...capability(
        "post_publish",
        "Publish reviewed posts",
        "Publish one explicit reviewed draft after a stale-version check.",
        true,
      ),
      platformCapability: "wordpress_com_post_publish",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://public-api.wordpress.com/oauth2/authorize",
      tokenUrl: "https://public-api.wordpress.com/oauth2/token",
      requiredScopes: WORDPRESS_COM_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "WORDPRESS_COM_CLIENT_ID",
        label: "WordPress.com client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console WordPress.com Application client ID.",
      },
      {
        name: "WORDPRESS_COM_CLIENT_SECRET",
        label: "WordPress.com client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held WordPress.com client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    tool(
      "wordpressCom.listSites",
      "wordpress_com_site_list",
      "site_read",
      "read",
      false,
      "List at most twenty-five sites visible to the grant.",
      {},
    ),
    tool(
      "wordpressCom.getSite",
      "wordpress_com_site_get",
      "site_read",
      "read",
      false,
      "Read the authorized numeric site.",
      { siteId: numericId() },
      ["siteId"],
    ),
    tool(
      "wordpressCom.listPosts",
      "wordpress_com_post_list",
      "post_read",
      "read",
      false,
      "List one bounded page without following pagination.",
      {
        siteId: numericId(),
        maxResults: integer(1, 25),
        offset: integer(0, 100000),
        status: {
          type: "string",
          enum: ["publish", "private", "draft", "pending", "future"],
        },
        search: text(1, 250),
        orderBy: { type: "string", enum: ["date", "modified", "title", "ID"] },
        order: { type: "string", enum: ["ASC", "DESC"] },
      },
      ["siteId"],
    ),
    tool(
      "wordpressCom.getPost",
      "wordpress_com_post_get",
      "post_read",
      "read",
      false,
      "Read one explicit post and bounded editable content.",
      { siteId: numericId(), postId: numericId() },
      ["siteId", "postId"],
    ),
    tool(
      "wordpressCom.preparePostChange",
      "wordpress_com_post_prepare",
      "post_draft",
      "draft",
      false,
      "Prepare and hash one draft creation, update, or publication locally.",
      changeFields(false),
      ["operation", "siteId"],
    ),
    tool(
      "wordpressCom.createDraft",
      "wordpress_com_post_create_draft",
      "post_draft",
      "write",
      true,
      "Create one post forced to draft without publicizing it.",
      writeFields({ siteId: numericId(), ...postFields(true) }),
      ["siteId", "title", "content", "approvalId", "idempotencyKey"],
    ),
    tool(
      "wordpressCom.updateDraft",
      "wordpress_com_post_update_draft",
      "post_update",
      "write",
      true,
      "Update one explicit draft after a modified-time precondition.",
      writeFields({
        siteId: numericId(),
        postId: numericId(),
        expectedModified: isoDate(),
        ...postFields(false),
      }),
      ["siteId", "postId", "expectedModified", "approvalId", "idempotencyKey"],
    ),
    tool(
      "wordpressCom.publishPost",
      "wordpress_com_post_publish",
      "post_publish",
      "write",
      true,
      "Publish one explicit draft after a modified-time precondition.",
      writeFields({
        siteId: numericId(),
        postId: numericId(),
        expectedModified: isoDate(),
      }),
      ["siteId", "postId", "expectedModified", "approvalId", "idempotencyKey"],
    ),
  ],
  approvalProfiles: [
    {
      id: "wordpress_com_safe",
      label: "Safe",
      description:
        "Bounded site and post reads plus local change preparation run directly; draft creation, draft updates, and publication require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected WordPress.com operation supported by this connector runs without Relay per-action approval; connection ownership, the specific-blog grant, fixed routes, post-version checks, bounds, audits, redaction, idempotency, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "token_info",
      label: "WordPress.com specific-blog authorization",
      requiredScopes: WORDPRESS_COM_SCOPES,
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
    platformCapability: `wordpress_com_${capabilityId}`,
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
function numericId() {
  return {
    oneOf: [
      { type: "integer", minimum: 1 },
      { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
    ],
  };
}
function isoDate() {
  return { type: "string", minLength: 10, maxLength: 40, format: "date-time" };
}
function stringList(maxItems: number) {
  return { type: "array", maxItems, uniqueItems: true, items: text(1, 100) };
}
function postFields(requireContent: boolean) {
  return {
    title: text(1, 300),
    content: text(requireContent ? 1 : 0, 50000),
    excerpt: text(0, 2000),
    slug: text(1, 200),
    categories: stringList(20),
    tags: stringList(30),
  };
}
function changeFields(includeWrite: boolean) {
  return {
    operation: {
      type: "string",
      enum: ["create_draft", "update_draft", "publish"],
    },
    siteId: numericId(),
    postId: numericId(),
    expectedModified: isoDate(),
    ...postFields(false),
    ...(includeWrite ? writeFields({}) : {}),
  };
}
function writeFields(fields: Record<string, unknown>) {
  return { ...fields, approvalId: text(1, 200), idempotencyKey: text(1, 180) };
}
