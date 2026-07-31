import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
];
const reads = [
  action(
    "youtube_channels_list_mine",
    "Get connected YouTube channel",
    "Read the connected creator channel and its uploads playlist.",
  ),
  action(
    "youtube_playlists_list_mine",
    "List owned YouTube playlists",
    "Read the first twenty-five playlists owned by the connected creator.",
  ),
  action(
    "youtube_playlist_items_list",
    "List YouTube playlist items",
    "Read the first twenty-five items from one explicit playlist.",
  ),
  action(
    "youtube_videos_list",
    "Get YouTube videos",
    "Read at most twenty-five explicit video records.",
  ),
];
const blockedActions = [
  blocked(
    "youtube_search_history_export",
    "Search or export YouTube activity",
    "Search, history, Watch Later, broad exports, page tokens, and automatic pagination are blocked.",
  ),
  blocked(
    "youtube_content_mutation",
    "Mutate YouTube content",
    "Uploads and video, playlist, comment, caption, rating, and subscription mutations are blocked.",
  ),
  blocked(
    "youtube_advanced_services",
    "Use advanced YouTube services",
    "Live, Analytics, Reporting, membership, partner, and content-owner services are blocked.",
  ),
  blocked(
    "youtube_raw_service_account_access",
    "Use raw or service-account access",
    "Raw tools, service accounts, delegation, batching, retries, polling, and undocumented APIs are blocked.",
  ),
];
const maxResults = {
  type: "integer",
  minimum: 1,
  maximum: 25,
  default: 25,
};

export const YOUTUBE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "youtube",
  name: "YouTube",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/youtube/v3",
  providerWebsiteUrl: "https://www.youtube.com/",
  capabilities: [
    {
      ...capability(
        "channel_summary",
        "Summarize connected channel",
        "Read the connected creator channel and uploads playlist.",
        true,
      ),
      platformCapability: "youtube_channels_list_mine",
    },
    {
      ...capability(
        "playlists_list",
        "List owned playlists",
        "Read at most twenty-five playlists owned by the connected creator.",
        true,
      ),
      platformCapability: "youtube_playlists_list_mine",
    },
    {
      ...capability(
        "playlist_items_list",
        "List playlist items",
        "Read at most twenty-five items from one explicit playlist.",
        true,
      ),
      platformCapability: "youtube_playlist_items_list",
    },
    {
      ...capability(
        "videos_list",
        "Inspect videos",
        "Read at most twenty-five explicit video records.",
        true,
      ),
      platformCapability: "youtube_videos_list",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: YOUTUBE_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "youtube.getMyChannel",
      functionName: "youtube_channels_list_mine",
      aliases: ["youtube_channels_list_mine"],
      capability: "channel_summary",
      platformCapability: "youtube_channels_list_mine",
      action: "read",
      approvalRequired: false,
      description:
        "Read the connected creator channel, uploads playlist, status, and bounded statistics.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "youtube.listMyPlaylists",
      functionName: "youtube_playlists_list_mine",
      aliases: ["youtube_playlists_list_mine"],
      capability: "playlists_list",
      platformCapability: "youtube_playlists_list_mine",
      action: "read",
      approvalRequired: false,
      description:
        "Read one bounded first page of playlists owned by the connected creator.",
      inputSchema: {
        type: "object",
        properties: { maxResults },
        additionalProperties: false,
      },
    },
    {
      name: "youtube.listPlaylistItems",
      functionName: "youtube_playlist_items_list",
      aliases: ["youtube_playlist_items_list"],
      capability: "playlist_items_list",
      platformCapability: "youtube_playlist_items_list",
      action: "read",
      approvalRequired: false,
      description:
        "Read one bounded first page from an explicit YouTube playlist.",
      inputSchema: {
        type: "object",
        properties: {
          playlistId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,128}$",
            maxLength: 128,
          },
          maxResults,
        },
        required: ["playlistId"],
        additionalProperties: false,
      },
    },
    {
      name: "youtube.getVideos",
      functionName: "youtube_videos_list",
      aliases: ["youtube_videos_list"],
      capability: "videos_list",
      platformCapability: "youtube_videos_list",
      action: "read",
      approvalRequired: false,
      description:
        "Read semantic metadata, duration, status, and returned statistics for at most twenty-five explicit video IDs.",
      inputSchema: {
        type: "object",
        properties: {
          videoIds: {
            type: "array",
            minItems: 1,
            maxItems: 25,
            uniqueItems: true,
            items: {
              type: "string",
              pattern: "^[A-Za-z0-9_-]{1,64}$",
              maxLength: 64,
            },
          },
        },
        required: ["videoIds"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "youtube_read_only",
      label: "Read only",
      description:
        "Four connected-channel reads run automatically with a twenty-five item cap while search, history, writes, advanced services, raw access, and pagination remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The exact scope, connected channel, twenty-five item cap, attribution, first-page-only, redaction, and no-write boundaries remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "exact-scope-connected-channel",
      label: "Exact youtube.readonly scope and connected channel",
      requiredScopes: YOUTUBE_SCOPES,
    },
  ],
};
