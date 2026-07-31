import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const THREADS_SCOPES = ["threads_basic", "threads_content_publish"];

const readsAndDraft = [
  action(
    "threads_profile_get",
    "Read connected profile",
    "Read the exact OAuth-bound Threads profile.",
  ),
  action(
    "threads_own_posts_list",
    "List own posts",
    "List at most ten recent posts owned by the connected profile.",
  ),
  action(
    "threads_own_post_get",
    "Read own post",
    "Read one explicit post only after verifying it belongs to the connected profile.",
  ),
  action(
    "threads_text_post_draft",
    "Draft text post",
    "Prepare one plain-text post locally without contacting Threads.",
  ),
];
const publish = action(
  "threads_text_post_publish",
  "Publish text post",
  "Publish one approval-controlled plain-text post of at most 500 characters.",
);
const blocks = [
  blocked(
    "threads_broader_social_actions",
    "Block broader social actions",
    "Replies, discovery, insights, media, links, polls, tags, locations, quotes, reposts, deletion, bulk actions and arbitrary Graph access are not registered.",
  ),
  blocked(
    "threads_secret_exposure",
    "Block secret exposure",
    "App secrets and user access tokens never leave Railway or appear in agent results.",
  ),
];

export const THREADS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "threads",
  name: "Threads",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.facebook.com/documentation/threads/",
  providerWebsiteUrl: "https://www.threads.net/",
  capabilities: [
    {
      ...capability(
        "profile_read",
        "Read profile",
        "Read the exact connected Threads profile.",
        true,
      ),
      platformCapability: "profile_read",
    },
    {
      ...capability(
        "own_posts_read",
        "Read own posts",
        "List at most ten own posts and inspect one exact owned post.",
        true,
      ),
      platformCapability: "own_posts_read",
    },
    {
      ...capability(
        "text_post_draft",
        "Draft text posts",
        "Draft one plain-text post locally.",
        true,
      ),
      platformCapability: "text_post_draft",
    },
    {
      ...capability(
        "text_post_publish",
        "Publish text posts",
        "Publish one approval-controlled plain-text post.",
        true,
      ),
      platformCapability: "text_post_publish",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://threads.net/oauth/authorize",
      tokenUrl: "https://graph.threads.net/oauth/access_token",
      refreshUrl: "https://graph.threads.net/refresh_access_token",
      userInfoUrl:
        "https://graph.threads.net/me?fields=id,username,name,is_verified,threads_profile_picture_url,threads_biography",
      requiredScopes: THREADS_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "THREADS_APP_ID",
        label: "Threads app ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay public-app identifier.",
      },
      {
        name: "THREADS_APP_SECRET",
        label: "Threads app secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Railway-held app secret; never sent to a client or agent.",
      },
    ],
  },
  tools: [
    {
      name: "relay_threads_get_profile",
      functionName: "relay_threads_get_profile",
      aliases: ["threads_profile_get"],
      capability: "profile_read",
      platformCapability: "profile_read",
      action: "read",
      approvalRequired: false,
      description: "Read the exact connected Threads profile.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_threads_list_own_posts",
      functionName: "relay_threads_list_own_posts",
      aliases: ["threads_own_posts_list"],
      capability: "own_posts_read",
      platformCapability: "own_posts_read",
      action: "read",
      approvalRequired: false,
      description: "List at most ten recent own posts.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_threads_get_own_post",
      functionName: "relay_threads_get_own_post",
      aliases: ["threads_own_post_get"],
      capability: "own_posts_read",
      platformCapability: "own_posts_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact owned post.",
      inputSchema: {
        type: "object",
        properties: {
          postId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
        },
        required: ["postId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_threads_draft_text_post",
      functionName: "relay_threads_draft_text_post",
      aliases: ["threads_text_post_draft"],
      capability: "text_post_draft",
      platformCapability: "text_post_draft",
      action: "draft",
      approvalRequired: false,
      description: "Draft one plain-text post locally.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", minLength: 1, maxLength: 500 } },
        required: ["text"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_threads_publish_text_post",
      functionName: "relay_threads_publish_text_post",
      aliases: ["threads_text_post_publish"],
      capability: "text_post_publish",
      platformCapability: "text_post_publish",
      action: "write",
      approvalRequired: true,
      description: "Publish one approval-controlled plain-text post.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", minLength: 1, maxLength: 500 } },
        required: ["text"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "threads_safe",
      label: "Safe",
      description:
        "Profile reads, own-post reads and local drafts run; publishing requires exact-payload approval.",
      defaultSelected: true,
      allowedActions: readsAndDraft,
      approvalRequiredActions: [publish],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected Threads actions run without Relay per-action approval; exact profile ownership, provider authority, bounds, audits and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDraft, publish],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "bound_profile",
      label: "Exact app-scoped Threads profile",
      requiredScopes: THREADS_SCOPES,
    },
  ],
};
