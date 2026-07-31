import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const showRead = action(
  "transistor_show_read",
  "Read connected show",
  "Read redacted metadata for the exact connected show.",
);
const protectedReads = [
  action(
    "transistor_episode_read",
    "Read episodes",
    "List or inspect bounded episode records, including drafts and scheduled episodes.",
  ),
  action(
    "transistor_analytics_read",
    "Read analytics",
    "Read bounded aggregate show or episode download analytics.",
  ),
];
const blockedActions = [
  blocked(
    "transistor_publishing",
    "Publish or change content",
    "Show and episode creation, update, scheduling, publication, unpublication, and deletion are outside the read-only V1 contract.",
  ),
  blocked(
    "transistor_subscribers",
    "Access private subscribers",
    "Subscriber emails, private feed URLs, access grants, notifications, and subscriber administration are blocked.",
  ),
  blocked(
    "transistor_uploads_webhooks",
    "Upload files or manage webhooks",
    "Presigned uploads, local-file transfer, and webhook reads or mutations are blocked.",
  ),
  blocked(
    "transistor_raw_api",
    "Use arbitrary Transistor APIs",
    "Arbitrary paths, browser automation, caller-selected origins, and undocumented endpoints are blocked.",
  ),
];
const id = { type: "string", minLength: 1, maxLength: 200 };
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
export const TRANSISTOR_FM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "transistor-fm",
  name: "Transistor.fm",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.transistor.fm/",
  providerWebsiteUrl: "https://transistor.fm/",
  capabilities: [
    {
      ...capability(
        "show_read",
        "Read connected show",
        "Read redacted metadata for the exact show.",
        true,
      ),
      platformCapability: "transistor_show_read",
    },
    {
      ...capability(
        "episode_read",
        "Read episodes",
        "Read bounded protected episode records.",
        true,
      ),
      platformCapability: "transistor_episode_read",
    },
    {
      ...capability(
        "analytics",
        "Read analytics",
        "Read bounded aggregate show or episode downloads.",
        true,
      ),
      platformCapability: "transistor_analytics_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TRANSISTOR_API_KEY",
        label: "Transistor API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a resettable API key from the customer's Transistor account.",
      },
      {
        name: "TRANSISTOR_SHOW_ID",
        label: "Transistor show ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Bind Relay to one show ID or slug the key can access.",
      },
    ],
  },
  tools: [
    {
      name: "transistor.getShow",
      functionName: "transistor_show_get",
      aliases: ["transistor.getShow", "transistor_show_get"],
      capability: "show_read",
      platformCapability: "transistor_show_read",
      action: "read",
      approvalRequired: false,
      description: "Read redacted exact-show metadata.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "transistor.listEpisodes",
      functionName: "transistor_episode_list",
      aliases: ["transistor.listEpisodes", "transistor_episode_list"],
      capability: "episode_read",
      platformCapability: "transistor_episode_read",
      action: "read",
      approvalRequired: true,
      description: "List one bounded episode page.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["published", "scheduled", "draft"] },
          order: { type: "string", enum: ["asc", "desc"] },
          page: { type: "integer", minimum: 1, maximum: 1000 },
          perPage: { type: "integer", minimum: 1, maximum: 50 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "transistor.getEpisode",
      functionName: "transistor_episode_get",
      aliases: ["transistor.getEpisode", "transistor_episode_get"],
      capability: "episode_read",
      platformCapability: "transistor_episode_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact-show episode.",
      inputSchema: {
        type: "object",
        properties: { episodeId: id, approvalId },
        required: ["episodeId"],
        additionalProperties: false,
      },
    },
    {
      name: "transistor.getAnalytics",
      functionName: "transistor_analytics_get",
      aliases: ["transistor.getAnalytics", "transistor_analytics_get"],
      capability: "analytics",
      platformCapability: "transistor_analytics_read",
      action: "read",
      approvalRequired: true,
      description: "Read aggregate downloads for at most 366 days.",
      inputSchema: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["show", "episodes", "episode"] },
          episodeId: id,
          startDate: {
            type: "string",
            pattern: "^[0-9]{2}-[0-9]{2}-[0-9]{4}$",
          },
          endDate: { type: "string", pattern: "^[0-9]{2}-[0-9]{2}-[0-9]{4}$" },
          approvalId,
        },
        required: ["scope"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "transistor_safe",
      label: "Safe",
      description:
        "Redacted exact-show metadata runs directly; protected episode and analytics reads require matching approval.",
      defaultSelected: true,
      allowedActions: [showRead],
      approvalRequiredActions: protectedReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected read-only actions run without Relay per-action approval while exact-show binding, key secrecy, fixed origin, bounds, redaction, audits, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [showRead, ...protectedReads],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "show", label: "Transistor key and exact-show binding validation" },
  ],
};
