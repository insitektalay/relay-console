import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "bettermode_network_get",
    "Read network",
    "Read reduced identity, locale, membership, visibility, status, and aggregate metadata for the exact Network.",
  ),
  action(
    "bettermode_actor_get",
    "Read connected member",
    "Read reduced identity, status, role, and teammate metadata for the exactly configured member.",
  ),
  action(
    "bettermode_space_list",
    "List spaces",
    "List up to twenty-five reduced Space structure and aggregate summaries.",
  ),
];
const protectedReads = [
  action(
    "bettermode_member_list",
    "List members",
    "List up to twenty-five reduced member identity, status, role, and contribution summaries without email, profile, session, activity, URL, or raw data.",
  ),
  action(
    "bettermode_space_member_list",
    "List space members",
    "List up to twenty-five reduced member and Space-role summaries for one exact Space.",
  ),
  action(
    "bettermode_post_list",
    "List post metadata",
    "List up to twenty-five reduced Post lifecycle and engagement summaries without content, author identity, media, URLs, mentions, or raw fields.",
  ),
];
const writes = [
  action(
    "bettermode_space_member_add",
    "Add space member",
    "Add one exact existing member to one exact Space.",
  ),
  action(
    "bettermode_space_member_remove",
    "Remove space member",
    "Remove one exact existing member from one exact Space.",
  ),
];
const selected = [...catalogReads, ...protectedReads, ...writes];
const blockedActions = [
  blocked(
    "bettermode_content",
    "Read or write content",
    "Post and reply bodies, short content, descriptions, custom fields, drafts, private messages, embeds, files, media, attachments, mentions, reactions, topics, events, and arbitrary rich content are outside V1.",
  ),
  blocked(
    "bettermode_member_lifecycle",
    "Manage member lifecycle",
    "Creating, inviting, updating, verifying, suspending, blocking, deleting, impersonating another member, changing Network roles, or changing profile and authentication data is outside V1.",
  ),
  blocked(
    "bettermode_structure_admin",
    "Administer network structure",
    "Creating, updating, deleting, reordering, or configuring Networks, Spaces, Collections, Space roles, Post types, Tags, Topics, Badges, apps, themes, webhooks, SSO, settings, plans, and site state is outside V1.",
  ),
  blocked(
    "bettermode_moderation",
    "Moderate community",
    "Hiding, locking, pinning, archiving, deleting, reviewing, reporting, blocking, or otherwise moderating Posts, replies, members, and Spaces is outside V1.",
  ),
  blocked(
    "bettermode_communication",
    "Communicate or notify",
    "Creating Posts or replies, private messaging, email, invitations, notifications, broadcasts, reactions, and outbound webhooks are outside V1.",
  ),
  blocked(
    "bettermode_bulk_or_analytics",
    "Run bulk or analytics actions",
    "Automatic pagination, multi-member membership mutations, bulk loops, polling, exports, imports, analytics, quota probing, logs, and historical reloads are outside V1.",
  ),
  blocked(
    "bettermode_private_identity",
    "Read broader identity data",
    "Emails, external IDs, profile fields, extra properties, sessions, blocked-member graphs, avatars, banners, locations, locale, last-seen or verification activity, and raw member records are outside V1.",
  ),
  blocked(
    "bettermode_raw_graphql",
    "Use arbitrary Bettermode GraphQL",
    "Arbitrary queries, mutations, fields, variables, aliases, fragments, batching, introspection, alternate endpoints, guest or login token generation, app-token generation, bot tokens, raw responses, webhooks, Liquid, CLI, and direct database access are outside V1.",
  ),
];

const page = { type: "integer", minimum: 1, maximum: 10_000 };
const maxResults = { type: "integer", minimum: 1, maximum: 25 };
const id = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9_-]+$",
};
const tool = (
  name: string,
  functionName: string,
  capabilityId: string,
  actionType: "read" | "write",
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  approvalRequired: boolean,
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: capabilityId,
  platformCapability: `bettermode_${capabilityId}`,
  action: actionType,
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
    required: [...required, ...(approvalRequired ? ["approvalId"] : [])],
    additionalProperties: false,
  },
});

export const BETTERMODE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bettermode",
  name: "Bettermode",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.bettermode.com/docs/operations/schema/",
  providerWebsiteUrl: "https://bettermode.com/",
  capabilities: [
    {
      ...capability(
        "catalog_read",
        "Read Network catalog",
        "Inspect the exact Network, connected member, and bounded Space structure.",
        true,
      ),
      platformCapability: "bettermode_catalog_read",
    },
    {
      ...capability(
        "member_read",
        "Read members",
        "Inspect bounded reduced Network and Space member identity and role metadata.",
        true,
      ),
      platformCapability: "bettermode_member_read",
    },
    {
      ...capability(
        "post_metadata_read",
        "Read post metadata",
        "Inspect bounded Post lifecycle and engagement metadata without content or author identity.",
        true,
      ),
      platformCapability: "bettermode_post_metadata_read",
    },
    {
      ...capability(
        "space_membership_write",
        "Change Space membership",
        "Add or remove one exact existing member from one exact Space.",
        true,
      ),
      platformCapability: "bettermode_space_membership_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BETTERMODE_REGION",
        label: "Bettermode region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter us for api.bettermode.com or eu for api.bettermode.de. Relay accepts no custom GraphQL origin.",
      },
      {
        name: "BETTERMODE_NETWORK_ID",
        label: "Bettermode Network ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact Network ID the access token is intended to operate in.",
      },
      {
        name: "BETTERMODE_MEMBER_ID",
        label: "Bettermode integration member ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact dedicated least-privilege member ID represented by the access token. Relay rejects bot or different-member tokens.",
      },
      {
        name: "BETTERMODE_ACCESS_TOKEN",
        label: "Bettermode access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Provide a customer-generated app or member access token bound to the exact dedicated member. Relay encrypts it and sends it only as a Bearer header.",
      },
    ],
  },
  tools: [
    tool(
      "bettermode.getNetwork",
      "bettermode_network_get",
      "catalog_read",
      "read",
      "Read reduced metadata for the exact Network.",
      {},
      [],
      false,
    ),
    tool(
      "bettermode.getCurrentMember",
      "bettermode_actor_get",
      "catalog_read",
      "read",
      "Read the reduced connected-member identity and verify its exact ID.",
      {},
      [],
      false,
    ),
    tool(
      "bettermode.listSpaces",
      "bettermode_space_list",
      "catalog_read",
      "read",
      "List one bounded page of reduced Space structure.",
      { page, maxResults },
      [],
      false,
    ),
    tool(
      "bettermode.listMembers",
      "bettermode_member_list",
      "member_read",
      "read",
      "List one bounded page of reduced Network-member identity, role, status, and contribution metadata.",
      { page, maxResults },
      [],
      true,
    ),
    tool(
      "bettermode.listSpaceMembers",
      "bettermode_space_member_list",
      "member_read",
      "read",
      "List one bounded page of reduced members and roles for one exact Space.",
      { spaceId: id, page, maxResults },
      ["spaceId"],
      true,
    ),
    tool(
      "bettermode.listPosts",
      "bettermode_post_list",
      "post_metadata_read",
      "read",
      "List one bounded page of reduced Post metadata, optionally restricted to one exact Space.",
      { spaceId: id, page, maxResults },
      [],
      true,
    ),
    tool(
      "bettermode.addSpaceMember",
      "bettermode_space_member_add",
      "space_membership_write",
      "write",
      "Add one exact existing member to one exact Space.",
      { spaceId: id, memberId: id },
      ["spaceId", "memberId"],
      true,
    ),
    tool(
      "bettermode.removeSpaceMember",
      "bettermode_space_member_remove",
      "space_membership_write",
      "write",
      "Remove one exact existing member from one exact Space.",
      { spaceId: id, memberId: id },
      ["spaceId", "memberId"],
      true,
    ),
  ],
  approvalProfiles: [
    {
      id: "bettermode_safe",
      label: "Safe",
      description:
        "Exact Network, connected-member, and Space catalog reads run directly. Network/Space member identity, Post metadata, and all Space membership changes require matching approval.",
      defaultSelected: true,
      allowedActions: catalogReads,
      approvalRequiredActions: [...protectedReads, ...writes],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All eight selected bounded Bettermode V1 tools run without Relay per-action approval; encrypted credentials, exact region/Network/member binding, provider authority, fixed GraphQL documents, bounds, audits, privacy reduction, and system blocks still apply.",
      defaultSelected: false,
      allowedActions: selected,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "bettermode_access_token",
      label:
        "Bearer token authenticates the exactly configured member in the exactly configured Network and fixed region",
    },
  ],
};
