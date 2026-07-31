import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "ghost_self_hosted_posts_list",
    "List posts",
    "List at most twenty bounded post summaries, including drafts.",
  ),
  action(
    "ghost_self_hosted_post_get",
    "Read post",
    "Read one exact post and at most 50,000 characters of HTML.",
  ),
];
const writes = [
  action(
    "ghost_self_hosted_draft_create",
    "Create draft",
    "Create one unpublished draft from bounded title and HTML.",
  ),
  action(
    "ghost_self_hosted_post_update",
    "Update post",
    "Update the title or HTML of one exact post with collision detection.",
  ),
  action(
    "ghost_self_hosted_post_set_status",
    "Publish or unpublish post",
    "Set one exact post to published or draft with collision detection.",
  ),
  action(
    "ghost_self_hosted_post_delete",
    "Delete post",
    "Permanently delete one exact post.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "ghost_self_hosted_pages_tags",
    "Manage pages or tags",
    "Pages, tags, authors and navigation are unavailable in this posts-only V1.",
  ),
  blocked(
    "ghost_self_hosted_members_commerce",
    "Manage members or commerce",
    "Members, tiers, offers, subscriptions, newsletters and billing are unavailable.",
  ),
  blocked(
    "ghost_self_hosted_admin",
    "Administer Ghost",
    "Users, settings, themes, images, webhooks, integrations, keys and site administration are unavailable.",
  ),
  blocked(
    "ghost_self_hosted_raw_api",
    "Run arbitrary Admin API calls",
    "Agents cannot choose paths, query parameters, fields, filters, ordering, pages, authors, tags, visibility or arbitrary request bodies.",
  ),
  blocked(
    "ghost_self_hosted_private_network",
    "Reach private infrastructure",
    "Private, local, reserved, link-local, non-HTTPS and redirecting endpoints are unavailable; Relay opens no tunnel and keeps the web backend on Railway.",
  ),
  blocked(
    "ghost_self_hosted_bulk_export",
    "Bulk export content",
    "Twenty-row lists, one exact post, 50,000-character HTML and 256 KiB responses are the maximum supported surface.",
  ),
];
const postIdProperty = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
  maxLength: 24,
};
const updatedAtProperty = {
  type: "string",
  format: "date-time",
  maxLength: 40,
};

export const GHOST_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "ghost-self-hosted",
    name: "Ghost Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://docs.ghost.org/admin-api",
    providerWebsiteUrl: "https://ghost.org/docs/install/",
    capabilities: [
      {
        ...capability(
          "post_read",
          "Read posts",
          "List bounded post summaries and read one exact post, including draft content.",
          true,
        ),
        platformCapability: "ghost_self_hosted_post_read",
      },
      {
        ...capability(
          "draft_write",
          "Write drafts",
          "Create one draft or update the title and HTML of one exact post.",
          false,
        ),
        platformCapability: "ghost_self_hosted_draft_write",
      },
      {
        ...capability(
          "publication",
          "Publish and delete",
          "Publish, unpublish or permanently delete one exact post.",
          false,
        ),
        platformCapability: "ghost_self_hosted_publication",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "GHOST_SELF_HOSTED_INSTALLATION_URL",
          label: "Ghost installation URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The public HTTPS root of one current customer-operated Ghost installation, including any configured subdirectory.",
        },
        {
          name: "GHOST_SELF_HOSTED_ADMIN_API_KEY",
          label: "Ghost Admin API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "A dedicated Custom Integration Admin API key. Railway uses it only to sign short-lived request-local JWTs for the fixed posts surface.",
        },
      ],
    },
    tools: [
      {
        name: "ghostSelfHosted.listPosts",
        functionName: "ghost_self_hosted_posts_list",
        aliases: ["ghostSelfHosted.listPosts", "ghost_self_hosted_posts_list"],
        capability: "post_read",
        platformCapability: "ghost_self_hosted_post_read",
        action: "read",
        approvalRequired: true,
        description: "List at most twenty fixed-field post summaries.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "ghostSelfHosted.getPost",
        functionName: "ghost_self_hosted_post_get",
        aliases: ["ghostSelfHosted.getPost", "ghost_self_hosted_post_get"],
        capability: "post_read",
        platformCapability: "ghost_self_hosted_post_read",
        action: "read",
        approvalRequired: true,
        description: "Read one exact post and bounded HTML.",
        inputSchema: {
          type: "object",
          required: ["postId"],
          properties: {
            postId: postIdProperty,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "ghostSelfHosted.createDraft",
        functionName: "ghost_self_hosted_draft_create",
        aliases: [
          "ghostSelfHosted.createDraft",
          "ghost_self_hosted_draft_create",
        ],
        capability: "draft_write",
        platformCapability: "ghost_self_hosted_draft_write",
        action: "write",
        approvalRequired: true,
        description: "Create one unpublished post draft from title and HTML.",
        inputSchema: {
          type: "object",
          required: ["title", "html"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 200 },
            html: { type: "string", minLength: 1, maxLength: 50000 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "ghostSelfHosted.updatePost",
        functionName: "ghost_self_hosted_post_update",
        aliases: [
          "ghostSelfHosted.updatePost",
          "ghost_self_hosted_post_update",
        ],
        capability: "draft_write",
        platformCapability: "ghost_self_hosted_draft_write",
        action: "write",
        approvalRequired: true,
        description:
          "Update one exact post with optimistic collision detection.",
        inputSchema: {
          type: "object",
          required: ["postId", "updatedAt"],
          properties: {
            postId: postIdProperty,
            updatedAt: updatedAtProperty,
            title: { type: "string", minLength: 1, maxLength: 200 },
            html: { type: "string", minLength: 1, maxLength: 50000 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "ghostSelfHosted.setStatus",
        functionName: "ghost_self_hosted_post_set_status",
        aliases: [
          "ghostSelfHosted.setStatus",
          "ghost_self_hosted_post_set_status",
        ],
        capability: "publication",
        platformCapability: "ghost_self_hosted_publication",
        action: "write",
        approvalRequired: true,
        description:
          "Publish or unpublish one exact post with collision detection.",
        inputSchema: {
          type: "object",
          required: ["postId", "updatedAt", "status"],
          properties: {
            postId: postIdProperty,
            updatedAt: updatedAtProperty,
            status: { type: "string", enum: ["draft", "published"] },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "ghostSelfHosted.deletePost",
        functionName: "ghost_self_hosted_post_delete",
        aliases: [
          "ghostSelfHosted.deletePost",
          "ghost_self_hosted_post_delete",
        ],
        capability: "publication",
        platformCapability: "ghost_self_hosted_publication",
        action: "write",
        approvalRequired: true,
        description: "Permanently delete one exact post.",
        inputSchema: {
          type: "object",
          required: ["postId"],
          properties: {
            postId: postIdProperty,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "ghost_self_hosted_safe",
        label: "Safe",
        description:
          "All private reads and content mutations require approval. Exact installation binding, fixed posts-only routes, collision checks, bounds and audits always apply.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: allActions,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All six selected posts actions run without Relay per-action approval; exact authority, fixed routes, collision checks, bounds, redaction and audits still apply.",
        defaultSelected: false,
        allowedActions: allActions,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "ghost-admin-posts",
        label: "Ghost Admin API key and posts access",
      },
    ],
  };
