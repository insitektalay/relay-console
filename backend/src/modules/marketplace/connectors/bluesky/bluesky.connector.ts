import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { BLUESKY_SCOPE } from "../../bluesky/bluesky-constants";

const allowed = [
  action(
    "bluesky_profile_get",
    "Read bound Bluesky profile",
    "Read the OAuth-bound DID profile.",
  ),
  action(
    "bluesky_own_posts_list",
    "List own original posts",
    "List at most ten original posts authored by the bound DID.",
  ),
  action(
    "bluesky_text_post_draft",
    "Draft text post",
    "Draft a text-only post locally without provider side effects.",
  ),
];
const approvalRequired = [
  action(
    "bluesky_text_post_publish",
    "Publish text post",
    "Create one text-only app.bsky.feed.post record after exact-payload approval.",
  ),
];
const blockedActions = [
  blocked(
    "bluesky_non_text_social_action",
    "Block broader social actions",
    "Replies, quotes, reposts, likes, follows, deletes, media, embeds, private data, discovery, firehose, and bulk actions are not registered.",
  ),
  blocked(
    "bluesky_secret_exposure",
    "Block secret exposure",
    "OAuth tokens and DPoP key material never leave Railway.",
  ),
];

export const BLUESKY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bluesky",
  name: "Bluesky",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.bsky.app/docs/advanced-guides/oauth-client",
  providerWebsiteUrl: "https://bsky.app",
  capabilities: [
    {
      ...capability(
        "profile_read",
        "Read profile",
        "Read the OAuth-bound public profile.",
        true,
      ),
      platformCapability: "profile_read",
    },
    {
      ...capability(
        "own_posts_read",
        "Read own posts",
        "Read up to ten original posts for the bound DID.",
        true,
      ),
      platformCapability: "own_posts_read",
    },
    {
      ...capability(
        "text_post_draft",
        "Draft text post",
        "Draft one text-only post locally.",
        true,
      ),
      platformCapability: "text_post_draft",
    },
    {
      ...capability(
        "text_post_publish",
        "Publish text post",
        "Publish one approval-controlled text-only post.",
        true,
      ),
      platformCapability: "text_post_publish",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://oauth.bsky.app/authorize",
      tokenUrl: "https://oauth.bsky.app/token",
      requiredScopes: BLUESKY_SCOPE.split(" "),
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "BLUESKY_HANDLE",
        label: "Bluesky handle",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Handle resolved and strictly bound to one DID, PDS, and authorization issuer by Railway.",
      },
    ],
  },
  tools: [
    {
      name: "relay_bluesky_get_profile",
      functionName: "relay_bluesky_get_profile",
      aliases: ["bluesky_profile_get"],
      capability: "profile_read",
      platformCapability: "profile_read",
      action: "read",
      approvalRequired: false,
      description: "Read the OAuth-bound Bluesky profile.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_bluesky_list_own_posts",
      functionName: "relay_bluesky_list_own_posts",
      aliases: ["bluesky_own_posts_list"],
      capability: "own_posts_read",
      platformCapability: "own_posts_read",
      action: "read",
      approvalRequired: false,
      description: "List at most ten original posts for the bound DID.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_bluesky_draft_text_post",
      functionName: "relay_bluesky_draft_text_post",
      aliases: ["bluesky_text_post_draft"],
      capability: "text_post_draft",
      platformCapability: "text_post_draft",
      action: "draft",
      approvalRequired: false,
      description: "Draft a 1–300 grapheme text post locally.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", minLength: 1, maxLength: 1200 } },
        required: ["text"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_bluesky_publish_text_post",
      functionName: "relay_bluesky_publish_text_post",
      aliases: ["bluesky_text_post_publish"],
      capability: "text_post_publish",
      platformCapability: "text_post_publish",
      action: "write",
      approvalRequired: true,
      description: "Publish one exact approval-controlled text-only post.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1, maxLength: 1200 },
          approvalId: { type: "string" },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "bluesky_safe",
      label: "Safe",
      description: "Reads and drafts execute; publish requires exact approval.",
      defaultSelected: true,
      allowedActions: allowed,
      approvalRequiredActions: approvalRequired,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "One text-only publish may execute without Relay per-action approval and is always audited.",
      defaultSelected: false,
      allowedActions: [...allowed, ...approvalRequired],
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "bluesky_read_only",
      label: "Read only",
      description: "Only bound-profile and own-post reads are enabled.",
      defaultSelected: false,
      allowedActions: allowed.slice(0, 2),
      approvalRequiredActions: [],
      blockedActions: [...blockedActions, ...approvalRequired],
    },
    {
      id: "bluesky_no_access",
      label: "No access",
      description: "All Bluesky actions are blocked.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [...blockedActions, ...allowed, ...approvalRequired],
    },
  ],
  healthChecks: [
    {
      id: "bound_profile",
      label: "Bound DID profile and OAuth session",
      requiredScopes: BLUESKY_SCOPE.split(" "),
    },
  ],
};
