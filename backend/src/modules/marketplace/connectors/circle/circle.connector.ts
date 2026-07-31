import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "circle_community_get",
    "Read community",
    "Read reduced community identity and feature metadata.",
  ),
  action(
    "circle_space_list",
    "List spaces",
    "List up to twenty-five reduced Space summaries.",
  ),
  action(
    "circle_space_get",
    "Read space",
    "Read one exact reduced Space summary.",
  ),
  action(
    "circle_access_group_list",
    "List access groups",
    "List up to twenty-five Access Group summaries.",
  ),
];
const privateReads = [
  action(
    "circle_post_list",
    "List post metadata",
    "List up to twenty-five Post metadata summaries in one exact Space without body content or email addresses.",
  ),
  action(
    "circle_post_get",
    "Read post metadata",
    "Read one exact Post metadata summary without body content or email addresses.",
  ),
  action(
    "circle_member_list",
    "List members",
    "List up to twenty-five reduced member identity and activity summaries.",
  ),
  action(
    "circle_member_get",
    "Read member",
    "Read one exact reduced member identity and activity summary.",
  ),
  action(
    "circle_member_access_group_list",
    "List member access groups",
    "List Access Groups for one exact member.",
  ),
];
const writes = [
  action(
    "circle_space_member_add",
    "Add space member",
    "Add one exact member email to one exact Space.",
  ),
  action(
    "circle_space_member_remove",
    "Remove space member",
    "Remove one exact member email from one exact Space.",
  ),
  action(
    "circle_access_group_member_add",
    "Add access-group member",
    "Add one exact member email to one exact Access Group.",
  ),
  action(
    "circle_access_group_member_remove",
    "Remove access-group member",
    "Remove one exact member email from one exact Access Group.",
  ),
];
const selected = [...catalogReads, ...privateReads, ...writes];
const blockedActions = [
  blocked(
    "circle_content_body",
    "Read or write content bodies",
    "Post and comment bodies, course lessons, form submissions, chat messages, live transcripts, files, embeds, and arbitrary rich text are outside V1.",
  ),
  blocked(
    "circle_member_lifecycle",
    "Manage member lifecycle",
    "Inviting, creating, updating, banning, deactivating, deleting, impersonating, or changing member profiles and tags is outside V1.",
  ),
  blocked(
    "circle_structure_admin",
    "Administer community structure",
    "Creating, updating, deleting, archiving, or duplicating Communities, Spaces, Space Groups, Access Groups, courses, events, forms, topics, and settings is outside V1.",
  ),
  blocked(
    "circle_bulk_or_notifications",
    "Run bulk or notification actions",
    "Bulk membership changes, automatic pagination, polling, broadcasts, notifications, invitation links, and workflow-like loops are outside V1.",
  ),
  blocked(
    "circle_private_member_data",
    "Read broader member data",
    "Profile fields, SSO identifiers, tags, gamification details, avatars, profile URLs, invitation state, and raw member records are outside V1.",
  ),
  blocked(
    "circle_raw_api",
    "Use arbitrary Circle APIs",
    "Arbitrary endpoints, methods, query parameters, headers, bodies, origins, Headless tokens, member impersonation, and raw responses are outside V1.",
  ),
];

const id = () => ({
  type: "integer",
  minimum: 1,
  maximum: 9_007_199_254_740_991,
});
const email = () => ({
  type: "string",
  minLength: 3,
  maxLength: 254,
  format: "email",
});
const pagination = {
  page: { type: "integer", minimum: 1, maximum: 10_000 },
  maxResults: { type: "integer", minimum: 1, maximum: 25 },
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
  platformCapability: `circle_${capabilityId}`,
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

export const CIRCLE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "circle",
  name: "Circle",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.circle.so/apis/admin-api",
  providerWebsiteUrl: "https://circle.so/",
  capabilities: [
    {
      ...capability(
        "catalog_read",
        "Read community structure",
        "Inspect reduced Community, Space, and Access Group metadata.",
        true,
      ),
      platformCapability: "circle_catalog_read",
    },
    {
      ...capability(
        "content_metadata_read",
        "Read post metadata",
        "Inspect bounded Post lifecycle and engagement metadata without content bodies.",
        true,
      ),
      platformCapability: "circle_content_metadata_read",
    },
    {
      ...capability(
        "member_read",
        "Read member access",
        "Inspect reduced member identity, activity, and Access Group assignments.",
        true,
      ),
      platformCapability: "circle_member_read",
    },
    {
      ...capability(
        "membership_write",
        "Change exact membership",
        "Add or remove one exact member email from one exact Space or Access Group.",
        true,
      ),
      platformCapability: "circle_membership_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CIRCLE_ADMIN_V2_API_TOKEN",
        label: "Circle Admin API v2 token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated Admin V2 token in the community's Developers → Tokens page. Relay encrypts it and never exposes it to agents.",
      },
    ],
  },
  tools: [
    tool(
      "circle.getCommunity",
      "circle_community_get",
      "catalog_read",
      "read",
      "Read reduced identity and feature metadata for the connected Community.",
      {},
      [],
      false,
    ),
    tool(
      "circle.listSpaces",
      "circle_space_list",
      "catalog_read",
      "read",
      "List a bounded page of reduced Space summaries.",
      pagination,
      [],
      false,
    ),
    tool(
      "circle.getSpace",
      "circle_space_get",
      "catalog_read",
      "read",
      "Read one exact reduced Space summary.",
      { spaceId: id() },
      ["spaceId"],
      false,
    ),
    tool(
      "circle.listAccessGroups",
      "circle_access_group_list",
      "catalog_read",
      "read",
      "List a bounded page of Access Group summaries.",
      pagination,
      [],
      false,
    ),
    tool(
      "circle.listPosts",
      "circle_post_list",
      "content_metadata_read",
      "read",
      "List bounded Post metadata in one exact Space without bodies or email addresses.",
      {
        spaceId: id(),
        status: {
          type: "string",
          enum: ["draft", "published", "scheduled", "all"],
        },
        ...pagination,
      },
      ["spaceId"],
      true,
    ),
    tool(
      "circle.getPost",
      "circle_post_get",
      "content_metadata_read",
      "read",
      "Read one exact Post metadata summary without body content or email addresses.",
      { postId: id() },
      ["postId"],
      true,
    ),
    tool(
      "circle.listMembers",
      "circle_member_list",
      "member_read",
      "read",
      "List bounded reduced member identity and activity summaries.",
      {
        status: { type: "string", enum: ["active", "inactive", "all"] },
        ...pagination,
      },
      [],
      true,
    ),
    tool(
      "circle.getMember",
      "circle_member_get",
      "member_read",
      "read",
      "Read one exact reduced member identity and activity summary.",
      { memberId: id() },
      ["memberId"],
      true,
    ),
    tool(
      "circle.listMemberAccessGroups",
      "circle_member_access_group_list",
      "member_read",
      "read",
      "List Access Groups for one exact member.",
      { memberId: id(), ...pagination },
      ["memberId"],
      true,
    ),
    tool(
      "circle.addSpaceMember",
      "circle_space_member_add",
      "membership_write",
      "write",
      "Add one exact member email to one exact Space.",
      { spaceId: id(), email: email() },
      ["spaceId", "email"],
      true,
    ),
    tool(
      "circle.removeSpaceMember",
      "circle_space_member_remove",
      "membership_write",
      "write",
      "Remove one exact member email from one exact Space.",
      { spaceId: id(), email: email() },
      ["spaceId", "email"],
      true,
    ),
    tool(
      "circle.addAccessGroupMember",
      "circle_access_group_member_add",
      "membership_write",
      "write",
      "Add one exact member email to one exact Access Group.",
      { accessGroupId: id(), email: email() },
      ["accessGroupId", "email"],
      true,
    ),
    tool(
      "circle.removeAccessGroupMember",
      "circle_access_group_member_remove",
      "membership_write",
      "write",
      "Remove one exact member email from one exact Access Group.",
      { accessGroupId: id(), email: email() },
      ["accessGroupId", "email"],
      true,
    ),
  ],
  approvalProfiles: [
    {
      id: "circle_safe",
      label: "Safe",
      description:
        "Reduced Community, Space, and Access Group catalog reads run directly. Post metadata, member identity/access, and all membership changes require matching approval.",
      defaultSelected: true,
      allowedActions: catalogReads,
      approvalRequiredActions: [...privateReads, ...writes],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected bounded Circle V1 tools run without Relay per-action approval; encrypted token storage, fixed Admin v2 origin, provider authority, bounds, audits, privacy reduction, and system blocks still apply.",
      defaultSelected: false,
      allowedActions: selected,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "circle_admin_v2_token",
      label: "Circle Admin API v2 token can read the connected Community",
    },
  ],
};
