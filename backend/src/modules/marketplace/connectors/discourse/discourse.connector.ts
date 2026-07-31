import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "discourse_site_get",
    "Read site",
    "Read reduced identity and locale metadata for the configured Discourse site.",
  ),
  action(
    "discourse_actor_get",
    "Read connected actor",
    "Read reduced identity and authority metadata for the exactly configured API username.",
  ),
  action(
    "discourse_category_list",
    "List categories",
    "List up to twenty-five reduced Category summaries.",
  ),
  action(
    "discourse_tag_list",
    "List tags",
    "List up to twenty-five reduced Tag summaries.",
  ),
  action(
    "discourse_tag_group_list",
    "List tag groups",
    "List up to twenty-five reduced Tag Group summaries.",
  ),
];
const protectedReads = [
  action(
    "discourse_group_list",
    "List groups",
    "List up to twenty-five reduced Group summaries without biographies, email settings, or raw records.",
  ),
  action(
    "discourse_group_get",
    "Read group",
    "Read one exact reduced Group summary without biographies or email settings.",
  ),
  action(
    "discourse_group_member_list",
    "List group members",
    "List up to twenty-five reduced member identity summaries for one exact Group.",
  ),
  action(
    "discourse_topic_list",
    "List topic metadata",
    "List up to twenty-five latest Topic metadata summaries without post bodies, excerpts, media, or URLs.",
  ),
];
const writes = [
  action(
    "discourse_group_member_add",
    "Add group member",
    "Add one exact existing username to one exact Group.",
  ),
  action(
    "discourse_group_member_remove",
    "Remove group member",
    "Remove one exact username from one exact Group.",
  ),
];
const selected = [...catalogReads, ...protectedReads, ...writes];
const blockedActions = [
  blocked(
    "discourse_content",
    "Read or write content",
    "Post bodies, excerpts, cooked HTML, drafts, private messages, chat, uploads, files, media, polls, events, forms, and arbitrary rich content are outside V1.",
  ),
  blocked(
    "discourse_user_lifecycle",
    "Manage user lifecycle",
    "Creating, inviting, activating, approving, updating, anonymizing, suspending, silencing, deleting, impersonating, or changing trust and staff roles is outside V1.",
  ),
  blocked(
    "discourse_structure_admin",
    "Administer site structure",
    "Creating, updating, deleting, reordering, or configuring Categories, Groups, Tags, Tag Groups, badges, themes, plugins, webhooks, settings, and site state is outside V1.",
  ),
  blocked(
    "discourse_moderation",
    "Moderate community content",
    "Flagging, reviewing, deleting, moving, closing, pinning, archiving, hiding, locking, or otherwise moderating Topics, Posts, users, and reviewables is outside V1.",
  ),
  blocked(
    "discourse_communication",
    "Communicate or notify",
    "Creating Topics or Posts, private messaging, chat, email, invitations, notifications, broadcasts, and outbound webhooks are outside V1.",
  ),
  blocked(
    "discourse_bulk_or_analytics",
    "Run bulk or analytics actions",
    "Automatic pagination, bulk loops, polling, exports, backups, logs, Data Explorer, analytics, IP data, email lookups, and staff audit data are outside V1.",
  ),
  blocked(
    "discourse_private_identity",
    "Read broader identity data",
    "Emails, secondary emails, IP addresses, avatars, profile fields, custom fields, timezones, last-seen activity, user statistics, and raw user or member records are outside V1.",
  ),
  blocked(
    "discourse_raw_api",
    "Use arbitrary Discourse APIs",
    "Arbitrary endpoints, methods, parameters, headers, bodies, alternate origins, API usernames, raw responses, plugins, GraphQL, CLI, and direct database access are outside V1.",
  ),
];

const maxResults = { type: "integer", minimum: 1, maximum: 25 };
const groupId = { type: "integer", minimum: 1, maximum: 9_007_199_254_740_991 };
const name = {
  type: "string",
  minLength: 1,
  maxLength: 100,
  pattern: "^[A-Za-z0-9_.-]+$",
};
const tool = (
  nameValue: string,
  functionName: string,
  capabilityId: string,
  actionType: "read" | "write",
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  approvalRequired: boolean,
) => ({
  name: nameValue,
  functionName,
  aliases: [nameValue, functionName],
  capability: capabilityId,
  platformCapability: `discourse_${capabilityId}`,
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

export const DISCOURSE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "discourse",
  name: "Discourse",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.discourse.org/",
  providerWebsiteUrl: "https://www.discourse.org/",
  capabilities: [
    {
      ...capability(
        "catalog_read",
        "Read site structure",
        "Inspect reduced site, actor, Category, Tag, and Tag Group metadata.",
        true,
      ),
      platformCapability: "discourse_catalog_read",
    },
    {
      ...capability(
        "group_read",
        "Read groups",
        "Inspect reduced Group metadata and bounded member identity.",
        true,
      ),
      platformCapability: "discourse_group_read",
    },
    {
      ...capability(
        "topic_metadata_read",
        "Read topic metadata",
        "Inspect bounded latest Topic lifecycle and engagement metadata without content.",
        true,
      ),
      platformCapability: "discourse_topic_metadata_read",
    },
    {
      ...capability(
        "group_membership_write",
        "Change Group membership",
        "Add or remove one exact existing username from one exact Group.",
        true,
      ),
      platformCapability: "discourse_group_membership_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DISCOURSE_BASE_URL",
        label: "Discourse site URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the public HTTPS origin of the exact Discourse site, without a path.",
      },
      {
        name: "DISCOURSE_API_KEY",
        label: "Discourse API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated single-user, least-privilege API key in Admin → Advanced → API Keys. Relay encrypts it and never exposes it to agents.",
      },
      {
        name: "DISCOURSE_API_USERNAME",
        label: "Discourse API username",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact username associated with the dedicated API key. Relay fixes this value in every Api-Username header.",
      },
    ],
  },
  tools: [
    tool(
      "discourse.getSite",
      "discourse_site_get",
      "catalog_read",
      "read",
      "Read reduced basic metadata for the exactly configured site.",
      {},
      [],
      false,
    ),
    tool(
      "discourse.getCurrentUser",
      "discourse_actor_get",
      "catalog_read",
      "read",
      "Read reduced identity and authority metadata for the configured API username.",
      {},
      [],
      false,
    ),
    tool(
      "discourse.listCategories",
      "discourse_category_list",
      "catalog_read",
      "read",
      "List a bounded projection of Categories and subcategories.",
      { maxResults },
      [],
      false,
    ),
    tool(
      "discourse.listTags",
      "discourse_tag_list",
      "catalog_read",
      "read",
      "List a bounded projection of Tags without private-message counts.",
      { maxResults },
      [],
      false,
    ),
    tool(
      "discourse.listTagGroups",
      "discourse_tag_group_list",
      "catalog_read",
      "read",
      "List a bounded projection of Tag Groups without permission maps.",
      { maxResults },
      [],
      false,
    ),
    tool(
      "discourse.listGroups",
      "discourse_group_list",
      "group_read",
      "read",
      "List bounded reduced Group metadata without biographies, email settings, or raw records.",
      { maxResults },
      [],
      true,
    ),
    tool(
      "discourse.getGroup",
      "discourse_group_get",
      "group_read",
      "read",
      "Read one exact reduced Group summary.",
      { groupName: name },
      ["groupName"],
      true,
    ),
    tool(
      "discourse.listGroupMembers",
      "discourse_group_member_list",
      "group_read",
      "read",
      "List bounded reduced member identity for one exact Group.",
      { groupName: name, maxResults },
      ["groupName"],
      true,
    ),
    tool(
      "discourse.listLatestTopics",
      "discourse_topic_list",
      "topic_metadata_read",
      "read",
      "List bounded latest Topic metadata without post bodies, excerpts, media, URLs, or private-message data.",
      { page: { type: "integer", minimum: 0, maximum: 10_000 }, maxResults },
      [],
      true,
    ),
    tool(
      "discourse.addGroupMember",
      "discourse_group_member_add",
      "group_membership_write",
      "write",
      "Add one exact existing username to one exact Group.",
      { groupId, username: name },
      ["groupId", "username"],
      true,
    ),
    tool(
      "discourse.removeGroupMember",
      "discourse_group_member_remove",
      "group_membership_write",
      "write",
      "Remove one exact username from one exact Group.",
      { groupId, username: name },
      ["groupId", "username"],
      true,
    ),
  ],
  approvalProfiles: [
    {
      id: "discourse_safe",
      label: "Safe",
      description:
        "Reduced site, connected-actor, Category, Tag, and Tag Group catalog reads run directly. Group metadata, member identity, Topic metadata, and all Group membership changes require matching approval.",
      defaultSelected: true,
      allowedActions: catalogReads,
      approvalRequiredActions: [...protectedReads, ...writes],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected bounded Discourse V1 tools run without Relay per-action approval; encrypted credentials, exact site and API-username binding, provider authority, bounds, audits, privacy reduction, redirect denial, and system blocks still apply.",
      defaultSelected: false,
      allowedActions: selected,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "discourse_api_key",
      label:
        "API key authenticates as the exactly configured user on the exactly configured public HTTPS site",
    },
  ],
};
