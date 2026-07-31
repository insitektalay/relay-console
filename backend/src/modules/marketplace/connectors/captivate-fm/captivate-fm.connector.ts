import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const showRead = action(
  "captivate_show_read",
  "Read connected show",
  "Read redacted metadata and the feed URL for the exact connected show.",
);
const protectedReads = [
  action(
    "captivate_episode_read",
    "Read episodes",
    "List or inspect bounded episode records, including drafts and scheduled episodes.",
  ),
  action(
    "captivate_media_read",
    "Read media library",
    "List or inspect bounded media records for the exact show.",
  ),
  action(
    "captivate_analytics_read",
    "Read analytics",
    "Read bounded aggregate show or episode download analytics for an explicit period.",
  ),
];
const writes = [
  action(
    "captivate_episode_create",
    "Create episode",
    "Create a draft, scheduled, or published episode using media already in the exact show's library.",
  ),
  action(
    "captivate_episode_update",
    "Update episode",
    "Change bounded metadata, media assignment, schedule, publication state, or Apple listing state for one episode.",
  ),
];
const blockedActions = [
  blocked(
    "captivate_file_upload",
    "Upload local files",
    "Multipart media and artwork upload is not mounted in V1.",
  ),
  blocked(
    "captivate_account_admin",
    "Administer Captivate",
    "Users, roles, networks, plans, billing, destinations, private podcasts, monetization, dynamic content, and account administration are outside this contract.",
  ),
  blocked(
    "captivate_raw_api",
    "Use arbitrary Captivate APIs",
    "Arbitrary paths, caller-selected origins, browser automation, and undocumented endpoints are blocked.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const uuid = { type: "string", pattern: "^[0-9a-fA-F-]{36}$", maxLength: 36 };
const episodeFields = {
  title: { type: "string", minLength: 1, maxLength: 500 },
  itunesTitle: { type: "string", maxLength: 500 },
  mediaId: uuid,
  date: { type: "string", minLength: 10, maxLength: 40 },
  status: { type: "string", enum: ["Draft", "Published"] },
  shownotes: { type: "string", maxLength: 4000 },
  summary: { type: "string", maxLength: 4000 },
  itunesSubtitle: { type: "string", maxLength: 255 },
  author: { type: "string", maxLength: 255 },
  episodeArt: { type: "string", format: "uri", maxLength: 4096 },
  explicit: { type: "string", enum: ["clean", "explicit"] },
  episodeType: { type: "string", enum: ["full", "bonus", "trailer"] },
  episodeSeason: { type: "integer", minimum: 0, maximum: 1000000 },
  episodeNumber: { type: "integer", minimum: 0, maximum: 1000000 },
  donationLink: { type: "string", format: "uri", maxLength: 4096 },
  donationText: { type: "string", maxLength: 255 },
  link: { type: "string", format: "uri", maxLength: 4096 },
  itunesBlock: { type: "boolean" },
};

export const CAPTIVATE_FM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "captivate-fm",
  name: "Captivate.fm",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.captivate.fm/",
  providerWebsiteUrl: "https://www.captivate.fm/",
  capabilities: [
    {
      ...capability(
        "show_read",
        "Read connected show",
        "Read redacted metadata and feed URL for the exact show.",
        true,
      ),
      platformCapability: "captivate_show_read",
    },
    {
      ...capability(
        "episode_read",
        "Read episodes and media",
        "Read bounded protected episode and media records.",
        true,
      ),
      platformCapability: "captivate_episode_read",
    },
    {
      ...capability(
        "analytics",
        "Read analytics",
        "Read bounded aggregate show or episode download analytics.",
        true,
      ),
      platformCapability: "captivate_analytics_read",
    },
    {
      ...capability(
        "publishing",
        "Manage episodes",
        "Create or update episodes using media already in the exact show's library.",
        true,
      ),
      platformCapability: "captivate_publishing",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CAPTIVATE_API_KEY",
        label: "Captivate API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use the API key from the customer's Captivate account.",
      },
      {
        name: "CAPTIVATE_USER_ID",
        label: "Captivate user ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use the matching user UUID from the Captivate API key page.",
      },
      {
        name: "CAPTIVATE_SHOW_ID",
        label: "Captivate show ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Bind Relay to one show UUID that the user can access.",
      },
    ],
  },
  tools: [
    {
      name: "captivate.getShow",
      functionName: "captivate_show_get",
      aliases: ["captivate.getShow", "captivate_show_get"],
      capability: "show_read",
      platformCapability: "captivate_show_read",
      action: "read",
      approvalRequired: false,
      description: "Read the exact connected show and feed URL.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "captivate.listEpisodes",
      functionName: "captivate_episode_list",
      aliases: ["captivate.listEpisodes", "captivate_episode_list"],
      capability: "episode_read",
      platformCapability: "captivate_episode_read",
      action: "read",
      approvalRequired: true,
      description: "List at most fifty show episodes.",
      inputSchema: {
        type: "object",
        properties: {
          scheduledOnly: { type: "boolean" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "captivate.getEpisode",
      functionName: "captivate_episode_get",
      aliases: ["captivate.getEpisode", "captivate_episode_get"],
      capability: "episode_read",
      platformCapability: "captivate_episode_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact episode.",
      inputSchema: {
        type: "object",
        properties: { episodeId: uuid, approvalId },
        required: ["episodeId"],
        additionalProperties: false,
      },
    },
    {
      name: "captivate.listMedia",
      functionName: "captivate_media_list",
      aliases: ["captivate.listMedia", "captivate_media_list"],
      capability: "episode_read",
      platformCapability: "captivate_episode_read",
      action: "read",
      approvalRequired: true,
      description: "List one bounded page of show media.",
      inputSchema: {
        type: "object",
        properties: {
          offset: { type: "integer", minimum: 0, maximum: 10000 },
          sort: { type: "string", enum: ["ASC", "DESC"] },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "captivate.getMedia",
      functionName: "captivate_media_get",
      aliases: ["captivate.getMedia", "captivate_media_get"],
      capability: "episode_read",
      platformCapability: "captivate_episode_read",
      action: "read",
      approvalRequired: true,
      description: "Read one media record.",
      inputSchema: {
        type: "object",
        properties: { mediaId: uuid, approvalId },
        required: ["mediaId"],
        additionalProperties: false,
      },
    },
    {
      name: "captivate.getAnalytics",
      functionName: "captivate_analytics_get",
      aliases: ["captivate.getAnalytics", "captivate_analytics_get"],
      capability: "analytics",
      platformCapability: "captivate_analytics_read",
      action: "read",
      approvalRequired: true,
      description: "Read aggregate analytics for at most 366 days.",
      inputSchema: {
        type: "object",
        properties: {
          metric: { type: "string", enum: ["overview", "average", "total"] },
          episodeId: uuid,
          start: { type: "string", format: "date-time" },
          end: { type: "string", format: "date-time" },
          intervalDays: { type: "integer", minimum: 1, maximum: 366 },
          includeTopEpisodes: { type: "boolean" },
          approvalId,
        },
        required: ["metric"],
        additionalProperties: false,
      },
    },
    {
      name: "captivate.createEpisode",
      functionName: "captivate_episode_create",
      aliases: ["captivate.createEpisode", "captivate_episode_create"],
      capability: "publishing",
      platformCapability: "captivate_publishing",
      action: "write",
      approvalRequired: true,
      description: "Create a bounded episode using existing show media.",
      inputSchema: {
        type: "object",
        properties: { ...episodeFields, approvalId },
        required: ["title", "status"],
        additionalProperties: false,
      },
    },
    {
      name: "captivate.updateEpisode",
      functionName: "captivate_episode_update",
      aliases: ["captivate.updateEpisode", "captivate_episode_update"],
      capability: "publishing",
      platformCapability: "captivate_publishing",
      action: "write",
      approvalRequired: true,
      description: "Update one bounded episode.",
      inputSchema: {
        type: "object",
        properties: { episodeId: uuid, ...episodeFields, approvalId },
        required: ["episodeId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "captivate_safe",
      label: "Safe",
      description:
        "Redacted connected-show metadata runs directly; protected episode, media, analytics, and publishing actions require matching approval.",
      defaultSelected: true,
      allowedActions: [showRead],
      approvalRequiredActions: [...protectedReads, ...writes],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected documented actions run without Relay per-action approval while exact-user/show binding, credential secrecy, fixed origin, bounds, redaction, audits, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [showRead, ...protectedReads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "show",
      label: "Captivate credentials and exact-show binding validation",
    },
  ],
};
