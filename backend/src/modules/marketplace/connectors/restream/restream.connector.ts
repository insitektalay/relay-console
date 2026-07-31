import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const directReads = [
  action(
    "restream_profile_read",
    "Read connected profile",
    "Verify the connected Restream user and read their bounded profile.",
  ),
  action(
    "restream_channel_read",
    "Read streaming channels",
    "List the connected user's configured destination channels without destination credentials.",
  ),
];
const protectedActions = [
  action(
    "restream_event_read",
    "Read events",
    "List or inspect bounded upcoming, live, and historical streaming events.",
  ),
  action(
    "restream_chat_read",
    "Read event chat",
    "Read one bounded page of cross-platform event chat history.",
  ),
  action(
    "restream_analytics_read",
    "Read event analytics",
    "Read bounded viewer and chat-engagement analytics for one exact event.",
  ),
  action(
    "restream_storage_read",
    "Read storage",
    "List bounded recording and video-storage metadata.",
  ),
  action(
    "restream_clip_read",
    "Read clips",
    "List bounded clip projects or inspect one exact project and generated clips.",
  ),
  action(
    "restream_studio_read",
    "Read Studio assets",
    "List bounded Studio brands, audio, captions, fonts, QR codes, and tickers.",
  ),
  action(
    "restream_documented_api",
    "Use documented Restream HTTP API",
    "Call a fixed-origin documented v2 user HTTP endpoint for event, destination, recording, storage, clip, Studio, or channel lifecycle work; Safe mode requires approval.",
  ),
];
const blockedActions = [
  blocked(
    "restream_secret_transport",
    "Block streaming credentials",
    "Stream-key, SRT-key, chat-URL, destination-password, credential-bearing channel creation, and equivalent secret routes never enter agent inputs or results.",
  ),
  blocked(
    "restream_live_websocket",
    "Block live WebSocket sessions",
    "Unbounded streaming-status and live-chat WebSocket sessions, replies, and relays are not mounted in the turn-bounded connector.",
  ),
  blocked(
    "restream_credential_exposure",
    "Block OAuth credential exposure",
    "OAuth client secrets, authorization codes, access tokens, and refresh tokens stay in Railway's encrypted connection lifecycle.",
  ),
  blocked(
    "restream_raw_or_unbounded",
    "Block raw or unbounded access",
    "Caller-selected origins, OAuth endpoints, private interfaces, browser automation, automatic pagination, bulk loops, arbitrary binary proxying, and oversized payloads are blocked.",
  ),
];

export const RESTREAM_SCOPES = [
  "profile.read",
  "channels.read",
  "channels.write",
  "stream.read",
  "stream.write",
  "chat.read",
  "storage.read",
  "clips.read",
  "clips.write",
  "studio.read",
  "studio.write",
] as const;

const eventId = {
  type: "string",
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
};
const identifier = {
  type: "string",
  pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$",
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const RESTREAM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "restream",
  name: "Restream",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.restream.io/guide",
  providerWebsiteUrl: "https://restream.io/",
  capabilities: [
    {
      ...capability(
        "account_channels",
        "Account and channels",
        "Verify the connected profile and inspect configured destinations.",
        true,
      ),
      platformCapability: "restream_account_channels",
    },
    {
      ...capability(
        "events",
        "Streaming events",
        "Read, create, configure, and inspect events, destinations, recordings, transcriptions, and download links.",
        true,
      ),
      platformCapability: "restream_events",
    },
    {
      ...capability(
        "chat_analytics",
        "Chat and analytics",
        "Read bounded cross-platform event chat history and viewer or engagement analytics.",
        true,
      ),
      platformCapability: "restream_chat_analytics",
    },
    {
      ...capability(
        "storage_clips",
        "Storage and clips",
        "Inspect recordings and storage, resolve approved downloads, and create or inspect clip projects.",
        true,
      ),
      platformCapability: "restream_storage_clips",
    },
    {
      ...capability(
        "studio",
        "Restream Studio",
        "Read and manage OAuth-authorized Studio brands, audio, captions, fonts, QR codes, and tickers.",
        true,
      ),
      platformCapability: "restream_studio",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.restream.io/login",
      tokenUrl: "https://api.restream.io/oauth/token",
      refreshUrl: "https://api.restream.io/oauth/token",
      revocationUrl: "https://api.restream.io/oauth/revoke",
      userInfoUrl: "https://api.restream.io/v2/user/profile",
      requiredScopes: [...RESTREAM_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "RESTREAM_CLIENT_ID",
        label: "Restream OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned Restream application ID configured only on Railway.",
      },
      {
        name: "RESTREAM_CLIENT_SECRET",
        label: "Restream OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned Restream secret stored only in Railway's secret boundary.",
      },
    ],
  },
  tools: [
    {
      name: "restream.getProfile",
      functionName: "restream_profile_get",
      aliases: ["restream.getProfile", "restream_profile_get"],
      capability: "account_channels",
      platformCapability: "restream_account_channels",
      action: "read",
      approvalRequired: false,
      description: "Read the connected Restream profile.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "restream.listChannels",
      functionName: "restream_channel_list",
      aliases: ["restream.listChannels", "restream_channel_list"],
      capability: "account_channels",
      platformCapability: "restream_account_channels",
      action: "read",
      approvalRequired: false,
      description:
        "List configured Restream destination channels without credentials.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "restream.listEvents",
      functionName: "restream_event_list",
      aliases: ["restream.listEvents", "restream_event_list"],
      capability: "events",
      platformCapability: "restream_events",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page or collection of upcoming, live, or historical events.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["upcoming", "in-progress", "history"],
          },
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          source: { type: "integer", minimum: 1, maximum: 3 },
          scheduled: { type: "boolean" },
          approvalId,
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    {
      name: "restream.getEvent",
      functionName: "restream_event_get",
      aliases: ["restream.getEvent", "restream_event_get"],
      capability: "events",
      platformCapability: "restream_events",
      action: "read",
      approvalRequired: true,
      description: "Read one exact Restream event.",
      inputSchema: {
        type: "object",
        properties: { eventId, approvalId },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
    {
      name: "restream.getEventChatHistory",
      functionName: "restream_event_chat_history_get",
      aliases: [
        "restream.getEventChatHistory",
        "restream_event_chat_history_get",
      ],
      capability: "chat_analytics",
      platformCapability: "restream_chat_analytics",
      action: "read",
      approvalRequired: true,
      description:
        "Read at most 100 cross-platform chat messages for one event.",
      inputSchema: {
        type: "object",
        properties: {
          eventId,
          pageSize: { type: "integer", minimum: 1, maximum: 100 },
          pageToken: { type: "string", maxLength: 2000 },
          timestamp: { type: "integer", minimum: 0, maximum: 9999999999 },
          approvalId,
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
    {
      name: "restream.getEventAnalytics",
      functionName: "restream_event_analytics_get",
      aliases: ["restream.getEventAnalytics", "restream_event_analytics_get"],
      capability: "chat_analytics",
      platformCapability: "restream_chat_analytics",
      action: "read",
      approvalRequired: true,
      description: "Read viewer or chat-message analytics for one exact event.",
      inputSchema: {
        type: "object",
        properties: {
          eventId,
          kind: { type: "string", enum: ["viewers", "messages"] },
          approvalId,
        },
        required: ["eventId", "kind"],
        additionalProperties: false,
      },
    },
    {
      name: "restream.listStorageFiles",
      functionName: "restream_storage_file_list",
      aliases: ["restream.listStorageFiles", "restream_storage_file_list"],
      capability: "storage_clips",
      platformCapability: "restream_storage_clips",
      action: "read",
      approvalRequired: true,
      description: "List bounded Restream video-storage metadata.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "restream.listClipProjects",
      functionName: "restream_clip_project_list",
      aliases: ["restream.listClipProjects", "restream_clip_project_list"],
      capability: "storage_clips",
      platformCapability: "restream_storage_clips",
      action: "read",
      approvalRequired: true,
      description: "List one bounded page of Restream clip projects.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100 },
          cursor: { type: "string", maxLength: 2000 },
          sortBy: { type: "string", enum: ["CreatedAt", "LastActivity"] },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "restream.getClipProject",
      functionName: "restream_clip_project_get",
      aliases: ["restream.getClipProject", "restream_clip_project_get"],
      capability: "storage_clips",
      platformCapability: "restream_storage_clips",
      action: "read",
      approvalRequired: true,
      description:
        "Inspect one exact clip project and its bounded generated clips.",
      inputSchema: {
        type: "object",
        properties: { projectId: identifier, approvalId },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
    {
      name: "restream.listStudioAssets",
      functionName: "restream_studio_asset_list",
      aliases: ["restream.listStudioAssets", "restream_studio_asset_list"],
      capability: "studio",
      platformCapability: "restream_studio",
      action: "read",
      approvalRequired: true,
      description: "List a bounded class of Restream Studio assets.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "countdown-music",
              "audio-backgrounds",
              "brands",
              "captions",
              "fonts",
              "qr-codes",
              "tickers",
            ],
          },
          brandId: eventId,
          approvalId,
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    {
      name: "restream.request",
      functionName: "restream_documented_api_request",
      aliases: [
        "restream.request",
        "restream_documented_api_request",
        "restream_documented_api",
      ],
      capability: "events",
      platformCapability: "restream_events",
      action: "admin",
      approvalRequired: true,
      description:
        "Call an exact documented v2 user HTTP endpoint at the fixed Restream API origin.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PATCH", "DELETE"] },
          path: { type: "string", pattern: "^/v2/user/", maxLength: 1000 },
          query: { type: "object", maxProperties: 20 },
          json: { type: "object", maxProperties: 100 },
          approvalId,
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "restream_safe",
      label: "Safe",
      description:
        "Connected-profile and destination reads run directly; event, chat, analytics, storage, clip, Studio, download, mutation, deletion, and other documented API work requires approval.",
      defaultSelected: true,
      allowedActions: directReads,
      approvalRequiredActions: protectedActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected non-secret documented Restream HTTP action runs without Relay per-action approval while fixed origin, OAuth authority, bounds, audits, redaction, account and plan limits, and provider enforcement remain mandatory.",
      defaultSelected: false,
      allowedActions: [...directReads, ...protectedActions],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "connected_profile",
      label: "Restream OAuth token and connected-profile validation",
      requiredScopes: ["profile.read"],
    },
  ],
};
