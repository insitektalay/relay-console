import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MICROSOFT_TEAMS_REQUIRED_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "https://graph.microsoft.com/Team.ReadBasic.All",
  "https://graph.microsoft.com/Channel.ReadBasic.All",
] as const;

const reads = [
  action(
    "microsoft_teams_joined_teams_list",
    "List joined teams",
    "Read up to twenty-five teams where the signed-in work user is a direct member.",
  ),
  action(
    "microsoft_teams_team_get",
    "Get team",
    "Read useful metadata for one explicit prior-result team.",
  ),
  action(
    "microsoft_teams_channels_list",
    "List team channels",
    "Read up to twenty-five channels visible to the signed-in user in one explicit team.",
  ),
  action(
    "microsoft_teams_channel_get",
    "Get team channel",
    "Read useful metadata for one explicit prior-result channel in one explicit team.",
  ),
];
const blockedActions = [
  blocked(
    "microsoft_teams_messages_chats",
    "Read messages or chats",
    "Channel messages, replies, private chats, bodies, senders, reactions, search, subscriptions, and metered export APIs are blocked.",
  ),
  blocked(
    "microsoft_teams_members_directory",
    "Read members or directory",
    "Members, owners, rosters, profiles, email addresses, users, groups, and directory data are blocked.",
  ),
  blocked(
    "microsoft_teams_files_meetings_calls",
    "Access other Teams workloads",
    "Files, tabs, apps, meetings, calls, recordings, transcripts, calendars, and other Microsoft Graph workloads are blocked.",
  ),
  blocked(
    "microsoft_teams_writes_admin",
    "Mutate or administer Teams",
    "Team/channel/message mutations, sends, application permissions, RSC, admin scopes, tenant enumeration, and consent management are blocked.",
  ),
  blocked(
    "microsoft_teams_export_raw_pagination",
    "Export or use raw Graph",
    "Exports, delta, arbitrary queries, raw endpoints, beta Graph, automatic pagination, polling, retries, and CLI or MCP passthrough are blocked.",
  ),
];
const identifier = {
  type: "string",
  pattern: "^[A-Za-z0-9_.:@-]{1,256}$",
  maxLength: 256,
};

export const MICROSOFT_TEAMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-teams",
    name: "Microsoft Teams",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://learn.microsoft.com/graph/teams-concept-overview",
    providerWebsiteUrl: "https://www.microsoft.com/microsoft-teams/",
    capabilities: [
      {
        ...capability(
          "joined_teams_list",
          "List joined teams",
          "Read directly joined team metadata.",
          true,
        ),
        platformCapability: "microsoft_teams_joined_teams_list",
      },
      {
        ...capability(
          "team_get",
          "Inspect a team",
          "Read one explicit team's useful metadata.",
          true,
        ),
        platformCapability: "microsoft_teams_team_get",
      },
      {
        ...capability(
          "channels_list",
          "List visible channels",
          "Read visible channel metadata in one explicit team.",
          true,
        ),
        platformCapability: "microsoft_teams_channels_list",
      },
      {
        ...capability(
          "channel_get",
          "Inspect a channel",
          "Read one explicit channel's useful metadata.",
          true,
        ),
        platformCapability: "microsoft_teams_channel_get",
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
        requiredScopes: [...MICROSOFT_TEAMS_REQUIRED_SCOPES],
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
          helpText: "Railway-held Relay Console Entra application client ID.",
        },
        {
          name: "MICROSOFT_CLIENT_SECRET",
          label: "Microsoft application client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["oauth"],
          helpText:
            "Railway-held confidential client secret; never sent to agents or clients.",
        },
      ],
    },
    tools: [
      {
        name: "microsoftTeams.listJoinedTeams",
        functionName: "microsoft_teams_joined_teams_list",
        aliases: ["microsoft_teams_joined_teams_list"],
        capability: "joined_teams_list",
        platformCapability: "microsoft_teams_joined_teams_list",
        action: "read",
        approvalRequired: false,
        description: "Read one bounded response of directly joined teams.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoftTeams.getTeam",
        functionName: "microsoft_teams_team_get",
        aliases: ["microsoft_teams_team_get"],
        capability: "team_get",
        platformCapability: "microsoft_teams_team_get",
        action: "read",
        approvalRequired: false,
        description: "Read one explicit team's metadata.",
        inputSchema: {
          type: "object",
          properties: { teamId: identifier },
          required: ["teamId"],
          additionalProperties: false,
        },
      },
      {
        name: "microsoftTeams.listChannels",
        functionName: "microsoft_teams_channels_list",
        aliases: ["microsoft_teams_channels_list"],
        capability: "channels_list",
        platformCapability: "microsoft_teams_channels_list",
        action: "read",
        approvalRequired: false,
        description:
          "Read one bounded response of visible channels in an explicit team.",
        inputSchema: {
          type: "object",
          properties: { teamId: identifier },
          required: ["teamId"],
          additionalProperties: false,
        },
      },
      {
        name: "microsoftTeams.getChannel",
        functionName: "microsoft_teams_channel_get",
        aliases: ["microsoft_teams_channel_get"],
        capability: "channel_get",
        platformCapability: "microsoft_teams_channel_get",
        action: "read",
        approvalRequired: false,
        description: "Read one explicit channel's metadata.",
        inputSchema: {
          type: "object",
          properties: { teamId: identifier, channelId: identifier },
          required: ["teamId", "channelId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_teams_read_only",
        label: "Read only",
        description:
          "Four delegated work-account team/channel metadata reads run automatically; messages, rosters, other workloads, writes, admin authority, metered APIs, raw access, and pagination remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The exact delegated scopes, work-account boundary, four typed metadata reads, first-page-only behavior, privacy exclusions, and no-write invariants remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "exact_delegated_teams_metadata",
        label: "Exact delegated work-account team and channel metadata",
        requiredScopes: [...MICROSOFT_TEAMS_REQUIRED_SCOPES],
      },
    ],
  };
