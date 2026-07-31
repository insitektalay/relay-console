import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "mighty_networks_network_get",
    "Read network",
    "Read reduced identity metadata for the configured Network.",
  ),
  action(
    "mighty_networks_space_list",
    "List spaces",
    "List up to twenty-five reduced Space summaries.",
  ),
  action(
    "mighty_networks_space_get",
    "Read space",
    "Read one exact reduced Space summary.",
  ),
];
const protectedReads = [
  action(
    "mighty_networks_member_list",
    "List members",
    "List up to twenty-five reduced member identity and role summaries.",
  ),
  action(
    "mighty_networks_member_get",
    "Read member",
    "Read one exact reduced member identity and role summary.",
  ),
  action(
    "mighty_networks_post_list",
    "List post metadata",
    "List up to twenty-five Post metadata summaries without body, media, URL, or author email.",
  ),
  action(
    "mighty_networks_post_get",
    "Read post metadata",
    "Read one exact Post metadata summary without body, media, URL, or author email.",
  ),
  action(
    "mighty_networks_space_member_list",
    "List space members",
    "List up to twenty-five reduced members in one exact Space.",
  ),
];
const writes = [
  action(
    "mighty_networks_space_member_add",
    "Add space member",
    "Directly add one exact existing user to one exact Space.",
  ),
  action(
    "mighty_networks_space_member_remove",
    "Remove space member",
    "Remove one exact user from one exact Space.",
  ),
];
const selected = [...catalogReads, ...protectedReads, ...writes];
const blockedActions = [
  blocked(
    "mighty_networks_content_body",
    "Read or write content bodies",
    "Post, Comment, Course, Poll, Event, Page, chat, livestream, attachment, file, and rich-media content is outside V1.",
  ),
  blocked(
    "mighty_networks_member_lifecycle",
    "Manage member lifecycle",
    "Creating, inviting, updating, banning, deleting, removing from the Network, changing roles, resetting passwords, or editing profiles is outside V1.",
  ),
  blocked(
    "mighty_networks_plan_or_money",
    "Manage plans or money",
    "Plans, purchases, subscriptions, billing, payment access, plan membership, refunds, and financial state are outside V1.",
  ),
  blocked(
    "mighty_networks_structure_admin",
    "Administer network structure",
    "Creating, updating, deleting, archiving, reordering, or configuring Networks, Spaces, Collections, events, fields, tags, badges, webhooks, and settings is outside V1.",
  ),
  blocked(
    "mighty_networks_bulk_or_notifications",
    "Run bulk or notification actions",
    "Bulk loops, automatic pagination, polling, broadcasts, invitations, notifications, and workflow-like automation are outside V1.",
  ),
  blocked(
    "mighty_networks_private_member_data",
    "Read broader member data",
    "Avatars, location, timezone, bio, permalink, custom fields, tags, badges, activity details, and raw member records are outside V1.",
  ),
  blocked(
    "mighty_networks_raw_api",
    "Use arbitrary Mighty APIs",
    "Arbitrary endpoints, methods, query parameters, headers, bodies, alternate origins, Headless API tokens, and raw responses are outside V1.",
  ),
];

const id = () => ({
  type: "integer",
  minimum: 1,
  maximum: 9_007_199_254_740_991,
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
  platformCapability: `mighty_networks_${capabilityId}`,
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

export const MIGHTY_NETWORKS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "mighty-networks",
    name: "Mighty Networks",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://docs.mightynetworks.com/admin-api",
    providerWebsiteUrl: "https://www.mightynetworks.com/",
    capabilities: [
      {
        ...capability(
          "catalog_read",
          "Read network structure",
          "Inspect reduced Network and Space metadata.",
          true,
        ),
        platformCapability: "mighty_networks_catalog_read",
      },
      {
        ...capability(
          "member_read",
          "Read members",
          "Inspect reduced member identity, role, and Space membership.",
          true,
        ),
        platformCapability: "mighty_networks_member_read",
      },
      {
        ...capability(
          "content_metadata_read",
          "Read post metadata",
          "Inspect bounded Post lifecycle and engagement metadata without content bodies.",
          true,
        ),
        platformCapability: "mighty_networks_content_metadata_read",
      },
      {
        ...capability(
          "space_membership_write",
          "Change Space membership",
          "Add or remove one exact existing user from one exact Space.",
          true,
        ),
        platformCapability: "mighty_networks_space_membership_write",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "MIGHTY_NETWORKS_ADMIN_API_TOKEN",
          label: "Mighty Networks Admin API token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Create a dedicated least-privilege Admin API key in the Network's Admin → Settings → API Keys page. Relay encrypts it and never exposes it to agents.",
        },
        {
          name: "MIGHTY_NETWORKS_NETWORK_ID",
          label: "Mighty Network ID or subdomain",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Enter the numeric Network ID or lowercase Network subdomain owned by this token.",
        },
      ],
    },
    tools: [
      tool(
        "mightyNetworks.getNetwork",
        "mighty_networks_network_get",
        "catalog_read",
        "read",
        "Read reduced identity metadata for the configured Mighty Network.",
        {},
        [],
        false,
      ),
      tool(
        "mightyNetworks.listSpaces",
        "mighty_networks_space_list",
        "catalog_read",
        "read",
        "List a bounded page of reduced Space summaries.",
        pagination,
        [],
        false,
      ),
      tool(
        "mightyNetworks.getSpace",
        "mighty_networks_space_get",
        "catalog_read",
        "read",
        "Read one exact reduced Space summary.",
        { spaceId: id() },
        ["spaceId"],
        false,
      ),
      tool(
        "mightyNetworks.listMembers",
        "mighty_networks_member_list",
        "member_read",
        "read",
        "List bounded reduced member identity and role summaries.",
        pagination,
        [],
        true,
      ),
      tool(
        "mightyNetworks.getMember",
        "mighty_networks_member_get",
        "member_read",
        "read",
        "Read one exact reduced member identity and role summary.",
        { memberId: id() },
        ["memberId"],
        true,
      ),
      tool(
        "mightyNetworks.listPosts",
        "mighty_networks_post_list",
        "content_metadata_read",
        "read",
        "List bounded Post metadata, optionally in one exact Space, without content bodies or private fields.",
        { spaceId: id(), ...pagination },
        [],
        true,
      ),
      tool(
        "mightyNetworks.getPost",
        "mighty_networks_post_get",
        "content_metadata_read",
        "read",
        "Read one exact Post metadata summary without content body or private fields.",
        { postId: id() },
        ["postId"],
        true,
      ),
      tool(
        "mightyNetworks.listSpaceMembers",
        "mighty_networks_space_member_list",
        "member_read",
        "read",
        "List bounded reduced members in one exact Space.",
        { spaceId: id(), ...pagination },
        ["spaceId"],
        true,
      ),
      tool(
        "mightyNetworks.addSpaceMember",
        "mighty_networks_space_member_add",
        "space_membership_write",
        "write",
        "Directly add one exact existing user to one exact Space.",
        { spaceId: id(), userId: id() },
        ["spaceId", "userId"],
        true,
      ),
      tool(
        "mightyNetworks.removeSpaceMember",
        "mighty_networks_space_member_remove",
        "space_membership_write",
        "write",
        "Remove one exact user from one exact Space.",
        { spaceId: id(), userId: id() },
        ["spaceId", "userId"],
        true,
      ),
    ],
    approvalProfiles: [
      {
        id: "mighty_networks_safe",
        label: "Safe",
        description:
          "Reduced Network and Space catalog reads run directly. Member identity, Post metadata, Space membership inspection, and all membership changes require matching approval.",
        defaultSelected: true,
        allowedActions: catalogReads,
        approvalRequiredActions: [...protectedReads, ...writes],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All selected bounded Mighty Networks V1 tools run without Relay per-action approval; encrypted token storage, exact Network binding, fixed origin and User-Agent, provider authority, bounds, audits, privacy reduction, and system blocks still apply.",
        defaultSelected: false,
        allowedActions: selected,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "mighty_networks_admin_token",
        label: "Admin API token can read the exactly configured Mighty Network",
      },
    ],
  };
