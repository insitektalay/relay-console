import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "local_wordpress_org_site_info",
    "Read site identity",
    "Read the home URL for one exact local WordPress installation.",
  ),
  action(
    "local_wordpress_org_list_posts",
    "List posts or pages",
    "List at most twenty bounded post or page metadata records for one explicit status.",
  ),
  action(
    "local_wordpress_org_get_post",
    "Read post or page",
    "Read one exact post or page with bounded editor content.",
  ),
];
const writes = [
  action(
    "local_wordpress_org_create_draft",
    "Create draft",
    "Create one post or page forced to draft with comments and pings closed.",
  ),
];
const blockedActions = [
  blocked(
    "local_wordpress_org_publish",
    "Publish or schedule content",
    "Publishing, scheduling and changing the status of existing content are unavailable.",
  ),
  blocked(
    "local_wordpress_org_update_delete",
    "Update or delete existing content",
    "Existing posts, pages, media, comments, terms and metadata cannot be changed, trashed or deleted.",
  ),
  blocked(
    "local_wordpress_org_admin",
    "Administer WordPress",
    "Users, roles, passwords, options, plugins, themes, core, databases, cache, cron, multisite, menus, widgets, imports, exports and server administration are unavailable.",
  ),
  blocked(
    "local_wordpress_org_raw_cli",
    "Run raw WP-CLI commands",
    "Agents cannot supply executable names, global flags, command names, arbitrary query arguments, PHP, shell commands or filesystem paths.",
  ),
  blocked(
    "local_wordpress_org_remote_api",
    "Expose the local site remotely",
    "Relay does not start a server, open a tunnel, add an application password, expose loopback traffic or redirect the web app from Railway.",
  ),
  blocked(
    "local_wordpress_org_unbounded_content",
    "Transfer unbounded content",
    "Lists are capped at twenty, one exact post read is capped at 64 KiB, and draft content is capped at 16 KiB.",
  ),
];

export const LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "local-wordpress-org",
    name: "Local WordPress.org",
    connectorType: "local_script",
    providerDocsUrl: "https://developer.wordpress.org/cli/commands/",
    providerWebsiteUrl: "https://wordpress.org/",
    capabilities: [
      {
        ...capability(
          "site_read",
          "Read local site",
          "Read bounded site identity and post or page content from one exact local WordPress installation.",
          true,
        ),
        platformCapability: "local_wordpress_org_site_read",
      },
      {
        ...capability(
          "draft_create",
          "Create local drafts",
          "Create one bounded post or page forced to draft without publishing.",
          false,
        ),
        platformCapability: "local_wordpress_org_draft_create",
      },
    ],
    auth: {
      type: "custom",
      credentialSchema: [
        {
          name: "LOCAL_WORDPRESS_ORG_SOURCE_HOST_ID",
          label: "Source host",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The connected Hermes or OpenClaw source host that has WP-CLI and the intended local WordPress installation.",
        },
        {
          name: "LOCAL_WORDPRESS_ORG_SOURCE_HOST_TYPE",
          label: "Source host type",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText: "hermes_bridge, openclaw_bridge, or runtime_host.",
        },
        {
          name: "LOCAL_WORDPRESS_ORG_SITE_PATH",
          label: "WordPress installation path",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "One exact absolute path containing the intended wp-config.php. Relay hashes it in audits and never exposes it to agents.",
        },
      ],
    },
    tools: [
      {
        name: "localWordPressOrg.siteInfo",
        functionName: "local_wordpress_org_site_info",
        aliases: [
          "localWordPressOrg.siteInfo",
          "local_wordpress_org_site_info",
        ],
        capability: "site_read",
        platformCapability: "local_wordpress_org_site_read",
        action: "read",
        approvalRequired: true,
        description:
          "Read the home URL for one exact local WordPress installation.",
        inputSchema: {
          type: "object",
          properties: { approvalId: { type: "string", maxLength: 200 } },
          additionalProperties: false,
        },
      },
      {
        name: "localWordPressOrg.listPosts",
        functionName: "local_wordpress_org_list_posts",
        aliases: [
          "localWordPressOrg.listPosts",
          "local_wordpress_org_list_posts",
        ],
        capability: "site_read",
        platformCapability: "local_wordpress_org_site_read",
        action: "read",
        approvalRequired: true,
        description:
          "List at most twenty post or page metadata records for one explicit status.",
        inputSchema: {
          type: "object",
          properties: {
            postType: {
              type: "string",
              enum: ["post", "page"],
              default: "post",
            },
            status: {
              type: "string",
              enum: ["draft", "publish", "pending", "private", "future"],
              default: "draft",
            },
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "localWordPressOrg.getPost",
        functionName: "local_wordpress_org_get_post",
        aliases: ["localWordPressOrg.getPost", "local_wordpress_org_get_post"],
        capability: "site_read",
        platformCapability: "local_wordpress_org_site_read",
        action: "read",
        approvalRequired: true,
        description: "Read one exact post or page with bounded editor content.",
        inputSchema: {
          type: "object",
          properties: {
            postId: { type: "integer", minimum: 1 },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["postId"],
          additionalProperties: false,
        },
      },
      {
        name: "localWordPressOrg.createDraft",
        functionName: "local_wordpress_org_create_draft",
        aliases: [
          "localWordPressOrg.createDraft",
          "local_wordpress_org_create_draft",
        ],
        capability: "draft_create",
        platformCapability: "local_wordpress_org_draft_create",
        action: "write",
        approvalRequired: true,
        description:
          "Create one bounded post or page forced to draft with comments and pings closed.",
        inputSchema: {
          type: "object",
          properties: {
            postType: {
              type: "string",
              enum: ["post", "page"],
              default: "post",
            },
            title: { type: "string", minLength: 1, maxLength: 200 },
            content: { type: "string", minLength: 1, maxLength: 16384 },
            excerpt: { type: "string", minLength: 1, maxLength: 1000 },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["title", "content"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "local_wordpress_org_safe",
        label: "Safe",
        description:
          "Private local site reads and draft creation require approval. Exact source-host and site-path binding, WP-CLI allowlists, output bounds and audits always apply.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [...reads, ...writes],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All four selected operations run without Relay per-action approval; exact source-host and site binding, fixed WP-CLI commands, draft-only writes, bounds and audits still apply.",
        defaultSelected: false,
        allowedActions: [...reads, ...writes],
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "wp_cli_site",
        label: "WP-CLI and exact local WordPress installation",
      },
    ],
  };
