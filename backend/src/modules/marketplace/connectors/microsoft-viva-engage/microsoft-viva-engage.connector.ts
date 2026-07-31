import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MICROSOFT_VIVA_ENGAGE_SCOPES = [
  "offline_access",
  "access_as_user",
];

const reads = [
  action(
    "microsoft_viva_engage_network_get",
    "Get Viva Engage network",
    "Read fixed safe metadata for the connected Viva Engage network.",
  ),
  action(
    "microsoft_viva_engage_current_user_get",
    "Get current Viva Engage user",
    "Read the signed-in user's ID and display name without contact or profile details.",
  ),
  action(
    "microsoft_viva_engage_my_communities_list",
    "List my Viva Engage communities",
    "Read at most twenty-five safe summaries for communities joined by the signed-in user.",
  ),
  action(
    "microsoft_viva_engage_selected_community_messages_list",
    "List selected-community messages",
    "Read at most twenty-five privacy-scrubbed messages from one verified selected community.",
  ),
];
const blockedActions = [
  blocked(
    "microsoft_viva_engage_private_global_feeds",
    "Read private or broad feeds",
    "Private messages, inboxes, direct messages, following feeds, global feeds, and algorithmic feeds are outside V1.",
  ),
  blocked(
    "microsoft_viva_engage_identities_members",
    "Read people or membership directories",
    "Emails, contact details, profile fields, senders, mentions, reactions, members, users, and membership directories are outside V1.",
  ),
  blocked(
    "microsoft_viva_engage_attachments_files",
    "Read attachments or files",
    "Attachments, files, previews, media, and download URLs are outside V1.",
  ),
  blocked(
    "microsoft_viva_engage_search_topics_export",
    "Search or export Viva Engage content",
    "Search, topics, analytics, bulk export, data export, and discovery beyond joined communities are outside V1.",
  ),
  blocked(
    "microsoft_viva_engage_posts_likes_deletes",
    "Change Viva Engage content",
    "Posts, replies, likes, reactions, deletes, announcements, and every other mutation are outside V1.",
  ),
  blocked(
    "microsoft_viva_engage_memberships_admin",
    "Change memberships or administration",
    "Joining, leaving, inviting, moderating, network administration, and compliance operations are outside V1.",
  ),
  blocked(
    "microsoft_viva_engage_pagination_raw",
    "Use broad or raw access",
    "Automatic pagination, retries, polling, undocumented endpoints, unsupported APIs, and raw provider requests are outside V1.",
  ),
];

export const MICROSOFT_VIVA_ENGAGE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-viva-engage",
    name: "Microsoft Viva Engage",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://learn.microsoft.com/en-us/rest/api/yammer/yammer-core-apis",
    providerWebsiteUrl: "https://www.microsoft.com/microsoft-viva/engage",
    capabilities: [
      {
        ...capability(
          "network_current_user",
          "Read network and current user",
          "Identify the connected network and signed-in user without exposing contact or profile data.",
          true,
        ),
        platformCapability: "microsoft_viva_engage_network_identity_read",
      },
      {
        ...capability(
          "communities",
          "Read joined communities",
          "Review bounded safe summaries for communities joined by the signed-in user.",
          true,
        ),
        platformCapability: "microsoft_viva_engage_communities_read",
      },
      {
        ...capability(
          "selected_community_messages",
          "Read selected-community messages",
          "Review bounded privacy-scrubbed messages in one verified selected community.",
          true,
        ),
        platformCapability:
          "microsoft_viva_engage_selected_community_messages_read",
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
        requiredScopes: MICROSOFT_VIVA_ENGAGE_SCOPES,
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
        name: "microsoft-viva-engage.getNetwork",
        functionName: "microsoft_viva_engage_network_get",
        aliases: [
          "microsoft-viva-engage.getNetwork",
          "relay_microsoft_viva_engage_get_network",
        ],
        capability: "network_current_user",
        platformCapability: "microsoft_viva_engage_network_identity_read",
        action: "read",
        approvalRequired: false,
        description: "Read fixed safe metadata for the connected network.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-viva-engage.getCurrentUser",
        functionName: "microsoft_viva_engage_current_user_get",
        aliases: [
          "microsoft-viva-engage.getCurrentUser",
          "relay_microsoft_viva_engage_get_current_user",
        ],
        capability: "network_current_user",
        platformCapability: "microsoft_viva_engage_network_identity_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read the signed-in user's ID and display name without contact or profile details.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-viva-engage.listMyCommunities",
        functionName: "microsoft_viva_engage_my_communities_list",
        aliases: [
          "microsoft-viva-engage.listMyCommunities",
          "relay_microsoft_viva_engage_list_my_communities",
        ],
        capability: "communities",
        platformCapability: "microsoft_viva_engage_communities_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read at most twenty-five safe summaries for joined communities.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-viva-engage.listSelectedCommunityMessages",
        functionName: "microsoft_viva_engage_selected_community_messages_list",
        aliases: [
          "microsoft-viva-engage.listSelectedCommunityMessages",
          "relay_microsoft_viva_engage_list_selected_community_messages",
        ],
        capability: "selected_community_messages",
        platformCapability:
          "microsoft_viva_engage_selected_community_messages_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read at most twenty-five privacy-scrubbed messages from the verified selected community.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_viva_engage_safe",
        label: "Safe",
        description:
          "Four fixed selected-community GET reads run automatically; broad feeds, identities, memberships, files, search, exports, writes, administration, pagination, and raw access remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same four reads run without Relay per-action approval; exact scope, selected-community binding, privacy projections, limits, audit, and Core API controls still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "selected_community",
        label:
          "Microsoft work-account authorization, access_as_user, refresh, network, current user, and selected-community validation",
        requiredScopes: MICROSOFT_VIVA_ENGAGE_SCOPES,
      },
    ],
  };
