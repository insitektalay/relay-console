import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const podcastRead = action(
  "buzzsprout_podcast_read",
  "Read connected podcast",
  "Read redacted metadata for the exact podcast bound to this connection.",
);
const episodeReads = [
  action(
    "buzzsprout_episode_list",
    "List episodes",
    "List at most fifty redacted episode summaries from the exact podcast.",
  ),
  action(
    "buzzsprout_episode_get",
    "Read episode",
    "Read one exact redacted episode, including unpublished episode metadata.",
  ),
];
const episodeWrites = [
  action(
    "buzzsprout_episode_create",
    "Create episode",
    "Create an episode, optionally import public HTTPS media, and consume the customer's upload allowance.",
  ),
  action(
    "buzzsprout_episode_update",
    "Update episode",
    "Change episode metadata, privacy, publication schedule, or hosted media references.",
  ),
];
const blockedActions = [
  blocked(
    "buzzsprout_episode_delete",
    "Delete episodes",
    "The official API documentation does not publish an episode deletion operation.",
  ),
  blocked(
    "buzzsprout_local_file_upload",
    "Upload local files",
    "Multipart local-file upload is not mounted; V1 accepts only validated public HTTPS media URLs.",
  ),
  blocked(
    "buzzsprout_account_admin",
    "Administer Buzzsprout",
    "Plans, billing, team members, podcast settings, directories, dynamic content, ads, subscriptions, and account administration are outside the documented API.",
  ),
  blocked(
    "buzzsprout_raw_api",
    "Use arbitrary Buzzsprout APIs",
    "Arbitrary paths, query-token authentication, browser automation, and undocumented endpoints are blocked.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const episodeId = {
  type: "integer",
  minimum: 1,
  maximum: 9_007_199_254_740_991,
};
const episodeFields = {
  title: { type: "string", minLength: 1, maxLength: 500 },
  description: { type: "string", maxLength: 50_000 },
  summary: { type: "string", maxLength: 10_000 },
  artist: { type: "string", maxLength: 500 },
  tags: { type: "string", maxLength: 5_000 },
  publishedAt: { type: ["string", "null"], format: "date-time" },
  duration: { type: "integer", minimum: 0, maximum: 604_800_000 },
  guid: { type: "string", minLength: 1, maxLength: 500 },
  inactiveAt: { type: ["string", "null"], format: "date-time" },
  episodeNumber: { type: ["integer", "null"], minimum: 0, maximum: 1_000_000 },
  seasonNumber: { type: ["integer", "null"], minimum: 0, maximum: 1_000_000 },
  explicit: { type: "boolean" },
  private: { type: "boolean" },
  emailUserAfterAudioProcessed: { type: "boolean" },
  audioUrl: { type: "string", format: "uri", maxLength: 4096 },
  artworkUrl: { type: "string", format: "uri", maxLength: 4096 },
};

export const BUZZSPROUT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "buzzsprout",
  name: "Buzzsprout",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.buzzsprout.com/api",
  providerWebsiteUrl: "https://www.buzzsprout.com/",
  capabilities: [
    {
      ...capability(
        "podcast_read",
        "Read connected podcast",
        "Read bounded redacted metadata for the exact connected podcast.",
        true,
      ),
      platformCapability: "buzzsprout_podcast_read",
    },
    {
      ...capability(
        "episode_read",
        "Read episodes",
        "List bounded redacted episodes or inspect one exact episode.",
        true,
      ),
      platformCapability: "buzzsprout_episode_read",
    },
    {
      ...capability(
        "episode_publish",
        "Create and update episodes",
        "Create episodes and change their metadata, media URLs, privacy, or publication schedule.",
        true,
      ),
      platformCapability: "buzzsprout_episode_publish",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BUZZSPROUT_API_TOKEN",
        label: "Buzzsprout API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the API token from the customer's own Buzzsprout account.",
      },
      {
        name: "BUZZSPROUT_PODCAST_ID",
        label: "Buzzsprout podcast ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Bind the connection to one numeric podcast ID returned by Buzzsprout.",
      },
    ],
  },
  tools: [
    {
      name: "buzzsprout.getPodcast",
      functionName: "buzzsprout_podcast_get",
      aliases: ["buzzsprout.getPodcast", "buzzsprout_podcast_get"],
      capability: "podcast_read",
      platformCapability: "buzzsprout_podcast_read",
      action: "read",
      approvalRequired: false,
      description: "Read redacted metadata for the exact connected podcast.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "buzzsprout.listEpisodes",
      functionName: "buzzsprout_episode_list",
      aliases: ["buzzsprout.listEpisodes", "buzzsprout_episode_list"],
      capability: "episode_read",
      platformCapability: "buzzsprout_episode_read",
      action: "read",
      approvalRequired: true,
      description: "List at most fifty redacted episode summaries.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 50 },
          includePrivate: { type: "boolean" },
          includeInactive: { type: "boolean" },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "buzzsprout.getEpisode",
      functionName: "buzzsprout_episode_get",
      aliases: ["buzzsprout.getEpisode", "buzzsprout_episode_get"],
      capability: "episode_read",
      platformCapability: "buzzsprout_episode_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact redacted episode.",
      inputSchema: {
        type: "object",
        properties: { episodeId, approvalId },
        required: ["episodeId"],
        additionalProperties: false,
      },
    },
    {
      name: "buzzsprout.createEpisode",
      functionName: "buzzsprout_episode_create",
      aliases: ["buzzsprout.createEpisode", "buzzsprout_episode_create"],
      capability: "episode_publish",
      platformCapability: "buzzsprout_episode_publish",
      action: "write",
      approvalRequired: true,
      description:
        "Create an episode with bounded metadata and optional public HTTPS media URLs.",
      inputSchema: {
        type: "object",
        properties: { ...episodeFields, approvalId },
        required: ["title"],
        additionalProperties: false,
      },
    },
    {
      name: "buzzsprout.updateEpisode",
      functionName: "buzzsprout_episode_update",
      aliases: ["buzzsprout.updateEpisode", "buzzsprout_episode_update"],
      capability: "episode_publish",
      platformCapability: "buzzsprout_episode_publish",
      action: "write",
      approvalRequired: true,
      description:
        "Update one episode's bounded metadata, media URLs, privacy, or publication schedule.",
      inputSchema: {
        type: "object",
        properties: { episodeId, ...episodeFields, approvalId },
        required: ["episodeId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "buzzsprout_safe",
      label: "Safe",
      description:
        "Connected-podcast metadata runs directly; episode reads and every publishing change require matching approval.",
      defaultSelected: true,
      allowedActions: [podcastRead],
      approvalRequiredActions: [...episodeReads, ...episodeWrites],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected documented Buzzsprout API action runs without Relay per-action approval while exact-podcast binding, credential secrecy, fixed origin, URL and response bounds, audits, upload allowance, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [podcastRead, ...episodeReads, ...episodeWrites],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "podcast",
      label: "Buzzsprout token and exact-podcast binding validation",
    },
  ],
};
