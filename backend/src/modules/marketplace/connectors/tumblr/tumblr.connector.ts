import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const TUMBLR_SCOPES = ["basic", "offline_access"];

const reads = [
  action(
    "tumblr_account_get",
    "Read connected account",
    "Read the exact OAuth-bound Tumblr account and its owned-blog summaries.",
  ),
  action(
    "tumblr_owned_blog_get",
    "Read selected owned blog",
    "Read the exact selected owned blog's useful public profile metadata.",
  ),
  action(
    "tumblr_owned_blog_recent_posts_list",
    "List recent published posts",
    "List at most ten recent published posts from the selected owned blog.",
  ),
];

const blocks = [
  blocked(
    "tumblr_private_or_write_actions",
    "Block private and write actions",
    "Dashboard, likes, follows, messages, drafts, queue, submissions, private posts, publishing, editing, deletion, reblogs and engagement are not registered.",
  ),
  blocked(
    "tumblr_raw_or_bulk_access",
    "Block raw and bulk access",
    "Arbitrary blogs, offsets, pagination, media downloads, bulk export and raw Tumblr API access are unavailable.",
  ),
];

export const TUMBLR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "tumblr",
  name: "Tumblr",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://github.com/tumblr/docs/blob/master/api.md",
  providerWebsiteUrl: "https://www.tumblr.com/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "Read account",
        "Read the exact connected Tumblr account and owned-blog summaries.",
        true,
      ),
      platformCapability: "account_read",
    },
    {
      ...capability(
        "owned_blog_read",
        "Read selected blog",
        "Read one selected owned blog and up to ten recent published posts.",
        true,
      ),
      platformCapability: "owned_blog_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.tumblr.com/oauth2/authorize",
      tokenUrl: "https://api.tumblr.com/v2/oauth2/token",
      refreshUrl: "https://api.tumblr.com/v2/oauth2/token",
      userInfoUrl: "https://api.tumblr.com/v2/user/info",
      requiredScopes: TUMBLR_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "TUMBLR_CONSUMER_KEY",
        label: "Tumblr OAuth consumer key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay application identifier.",
      },
      {
        name: "TUMBLR_CONSUMER_SECRET",
        label: "Tumblr OAuth consumer secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Railway-held app secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_tumblr_get_account",
      functionName: "relay_tumblr_get_account",
      aliases: ["tumblr_account_get"],
      capability: "account_read",
      platformCapability: "account_read",
      action: "read",
      approvalRequired: false,
      description: "Read the exact connected Tumblr account and owned blogs.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_tumblr_get_owned_blog",
      functionName: "relay_tumblr_get_owned_blog",
      aliases: ["tumblr_owned_blog_get"],
      capability: "owned_blog_read",
      platformCapability: "owned_blog_read",
      action: "read",
      approvalRequired: false,
      description: "Read the selected owned Tumblr blog.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_tumblr_list_owned_blog_recent_posts",
      functionName: "relay_tumblr_list_owned_blog_recent_posts",
      aliases: ["tumblr_owned_blog_recent_posts_list"],
      capability: "owned_blog_read",
      platformCapability: "owned_blog_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most ten recent published posts from the selected owned blog.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 10 },
          tag: { type: "string", minLength: 1, maxLength: 100 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "tumblr_safe",
      label: "Safe",
      description:
        "The three selected account, owned-blog and published-post reads run automatically; private, write, raw and bulk surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three reads run without Relay per-action approval; exact account/blog ownership, provider authority, bounds, audits and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "bound_account_and_owned_blog",
      label: "Exact Tumblr account and selected owned blog",
      requiredScopes: TUMBLR_SCOPES,
    },
  ],
};
