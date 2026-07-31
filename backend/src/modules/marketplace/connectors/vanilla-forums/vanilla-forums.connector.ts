import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "vanilla_forums_actor_get",
    "Read connected actor",
    "Read reduced identity and authority metadata for the user who created the configured access token.",
  ),
  action(
    "vanilla_forums_category_list",
    "List categories",
    "List up to twenty-five reduced Category summaries.",
  ),
  action(
    "vanilla_forums_badge_list",
    "List badges",
    "List up to twenty-five reduced Badge definitions without recipient data.",
  ),
];
const protectedReads = [
  action(
    "vanilla_forums_discussion_list",
    "List discussion metadata",
    "List up to twenty-five Discussion lifecycle and engagement summaries without bodies, excerpts, media, URLs, or author identity.",
  ),
  action(
    "vanilla_forums_user_list",
    "List users",
    "List up to twenty-five reduced community-user identity and aggregate summaries without email, IP, profile fields, SSO identifiers, activity timestamps, or raw records.",
  ),
];
const selected = [...catalogReads, ...protectedReads];
const blockedActions = [
  blocked(
    "vanilla_forums_content",
    "Read or write content",
    "Discussion and comment bodies, excerpts, rendered HTML, drafts, conversations, messages, knowledge articles, uploads, files, media, events, polls, and arbitrary rich content are outside V1.",
  ),
  blocked(
    "vanilla_forums_user_lifecycle",
    "Manage user lifecycle",
    "Creating, inviting, updating, merging, deleting, banning, warning, spoofing, assigning roles, or changing ranks and permissions is outside V1.",
  ),
  blocked(
    "vanilla_forums_structure_admin",
    "Administer community structure",
    "Creating, updating, deleting, reordering, or configuring Categories, Groups, Badges, Ranks, Products, Subcommunities, themes, addons, webhooks, settings, and site state is outside V1.",
  ),
  blocked(
    "vanilla_forums_moderation",
    "Moderate community content",
    "Flagging, reviewing, deleting, moving, closing, pinning, sinking, featuring, announcing, restoring, or otherwise moderating Discussions, Comments, users, and reports is outside V1.",
  ),
  blocked(
    "vanilla_forums_communication",
    "Communicate or notify",
    "Creating Discussions or Comments, conversations, direct messages, email, notifications, invitations, announcements, and outbound webhooks is outside V1.",
  ),
  blocked(
    "vanilla_forums_bulk_or_analytics",
    "Run bulk or analytics actions",
    "Automatic pagination, bulk loops, polling, CSV exports, imports, analytics, logs, audit data, high-frequency sync, and historical reloads are outside V1.",
  ),
  blocked(
    "vanilla_forums_private_identity",
    "Read broader identity data",
    "Email addresses, IP addresses, SSO IDs, profile fields, custom fields, avatars, locations, activity timestamps, private roles, and raw user records are outside V1.",
  ),
  blocked(
    "vanilla_forums_raw_api",
    "Use arbitrary Vanilla APIs",
    "Arbitrary endpoints, methods, fields, filters, expansions, headers, bodies, alternate origins, query-token authentication, role tokens, spoof headers, raw responses, webhooks, GraphQL, MCP, CLI, and direct database access are outside V1.",
  ),
];

const page = { type: "integer", minimum: 1, maximum: 10_000 };
const maxResults = { type: "integer", minimum: 1, maximum: 25 };
const tool = (
  name: string,
  functionName: string,
  capabilityId: string,
  description: string,
  properties: Record<string, unknown>,
  approvalRequired: boolean,
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: capabilityId,
  platformCapability: `vanilla_forums_${capabilityId}`,
  action: "read" as const,
  approvalRequired,
  description,
  inputSchema: {
    type: "object",
    properties: {
      ...properties,
      ...(approvalRequired
        ? { approvalId: { type: "string", minLength: 1, maxLength: 200 } }
        : {}),
    },
    required: approvalRequired ? ["approvalId"] : [],
    additionalProperties: false,
  },
});

export const VANILLA_FORUMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vanilla-forums",
  name: "Vanilla Forums",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://success.vanillaforums.com/kb/api",
  providerWebsiteUrl: "https://vanillaforums.com/",
  capabilities: [
    {
      ...capability(
        "catalog_read",
        "Read community catalog",
        "Inspect the connected actor and reduced Category and Badge metadata.",
        true,
      ),
      platformCapability: "vanilla_forums_catalog_read",
    },
    {
      ...capability(
        "discussion_metadata_read",
        "Read discussion metadata",
        "Inspect bounded Discussion lifecycle and engagement metadata without content or author identity.",
        true,
      ),
      platformCapability: "vanilla_forums_discussion_metadata_read",
    },
    {
      ...capability(
        "user_directory_read",
        "Read user directory",
        "Inspect bounded reduced user identity and aggregate contribution metadata.",
        true,
      ),
      platformCapability: "vanilla_forums_user_directory_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VANILLA_FORUMS_BASE_URL",
        label: "Vanilla community URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the public HTTPS origin of the exact Vanilla community, without /api/v2 or another path.",
      },
      {
        name: "VANILLA_FORUMS_ACCESS_TOKEN",
        label: "Vanilla personal access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a dedicated least-privilege personal access token from the Vanilla user profile. Relay encrypts it and sends it only as a Bearer header.",
      },
    ],
  },
  tools: [
    tool(
      "vanillaForums.getCurrentUser",
      "vanilla_forums_actor_get",
      "catalog_read",
      "Read reduced identity and authority metadata for the token-owning user.",
      {},
      false,
    ),
    tool(
      "vanillaForums.listCategories",
      "vanilla_forums_category_list",
      "catalog_read",
      "List one bounded page of reduced Category metadata.",
      { page, maxResults },
      false,
    ),
    tool(
      "vanillaForums.listBadges",
      "vanilla_forums_badge_list",
      "catalog_read",
      "List one bounded page of reduced Badge definitions without recipient data.",
      { page, maxResults },
      false,
    ),
    tool(
      "vanillaForums.listDiscussions",
      "vanilla_forums_discussion_list",
      "discussion_metadata_read",
      "List one bounded page of reduced Discussion metadata without bodies, excerpts, media, URLs, or author identity.",
      { page, maxResults },
      true,
    ),
    tool(
      "vanillaForums.listUsers",
      "vanilla_forums_user_list",
      "user_directory_read",
      "List one bounded page of reduced user identity and aggregate metadata without email, IP, profile fields, SSO identifiers, activity timestamps, or raw records.",
      { page, maxResults },
      true,
    ),
  ],
  approvalProfiles: [
    {
      id: "vanilla_forums_safe",
      label: "Safe",
      description:
        "Connected-actor, Category, and Badge catalog reads run directly. Discussion metadata and user-directory reads require matching approval.",
      defaultSelected: true,
      allowedActions: catalogReads,
      approvalRequiredActions: protectedReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected bounded Vanilla V1 reads run without Relay per-action approval; encrypted credentials, exact-site binding, token-owner permissions, field and page bounds, audits, privacy reduction, redirect denial, and system blocks still apply.",
      defaultSelected: false,
      allowedActions: selected,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "vanilla_forums_access_token",
      label:
        "Personal access token authenticates a user on the exactly configured public HTTPS Vanilla community",
    },
  ],
};
