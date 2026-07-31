import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MASTODON_SCOPES = [
  "read:accounts",
  "read:statuses",
  "write:statuses",
];

const readsAndDraft = [
  action(
    "mastodon_account_get",
    "Read connected account",
    "Read the exact OAuth-bound local account on the verified instance.",
  ),
  action(
    "mastodon_own_statuses_list",
    "List own statuses",
    "List at most ten recent own statuses, excluding replies and boosts.",
  ),
  action(
    "mastodon_text_status_draft",
    "Draft text status",
    "Prepare one bounded public or unlisted text status locally.",
  ),
];
const publish = action(
  "mastodon_text_status_publish",
  "Publish text status",
  "Publish one exact approval-controlled public or unlisted text status with an idempotency key.",
);
const blocks = [
  blocked(
    "mastodon_broader_social_actions",
    "Block broader social actions",
    "Timelines, discovery, other accounts, replies, quotes, direct posts, boosts, favourites, follows, blocks, reports, notifications, media, polls, edits, deletion, scheduling, streaming and moderation are not registered.",
  ),
  blocked(
    "mastodon_raw_or_unverified_instance_access",
    "Block raw and unverified access",
    "Private-network origins, redirects, arbitrary endpoints, pagination, bulk work, automatic retry and raw ActivityPub or Mastodon API access are unavailable.",
  ),
];

export const MASTODON_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mastodon",
  name: "Mastodon",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.joinmastodon.org/api/",
  providerWebsiteUrl: "https://joinmastodon.org/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "Read account",
        "Read the exact local account on one verified public Mastodon instance.",
        true,
      ),
      platformCapability: "account_read",
    },
    {
      ...capability(
        "own_statuses_read",
        "Read own statuses",
        "List at most ten recent own non-reply, non-boost statuses.",
        true,
      ),
      platformCapability: "own_statuses_read",
    },
    {
      ...capability(
        "text_status_publish",
        "Publish text statuses",
        "Draft and publish one bounded public or unlisted text status.",
        true,
      ),
      platformCapability: "text_status_publish",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://mastodon.invalid/oauth/authorize",
      tokenUrl: "https://mastodon.invalid/oauth/token",
      requiredScopes: MASTODON_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "MASTODON_INSTANCE_ORIGIN",
        label: "Mastodon instance URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "One public HTTPS Mastodon instance origin; paths, custom ports and private-network hosts are rejected.",
      },
    ],
  },
  tools: [
    {
      name: "relay_mastodon_get_account",
      functionName: "relay_mastodon_get_account",
      aliases: ["mastodon_account_get"],
      capability: "account_read",
      platformCapability: "account_read",
      action: "read",
      approvalRequired: false,
      description: "Read the exact connected Mastodon account.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_mastodon_list_own_statuses",
      functionName: "relay_mastodon_list_own_statuses",
      aliases: ["mastodon_own_statuses_list"],
      capability: "own_statuses_read",
      platformCapability: "own_statuses_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most ten recent own statuses without replies or boosts.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_mastodon_draft_text_status",
      functionName: "relay_mastodon_draft_text_status",
      aliases: ["mastodon_text_status_draft"],
      capability: "text_status_publish",
      platformCapability: "text_status_publish",
      action: "draft",
      approvalRequired: false,
      description: "Draft one bounded public or unlisted text status locally.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1, maxLength: 500 },
          visibility: { type: "string", enum: ["public", "unlisted"] },
          language: { type: "string", pattern: "^[a-z]{2}$" },
        },
        required: ["text", "visibility"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_mastodon_publish_text_status",
      functionName: "relay_mastodon_publish_text_status",
      aliases: ["mastodon_text_status_publish"],
      capability: "text_status_publish",
      platformCapability: "text_status_publish",
      action: "write",
      approvalRequired: true,
      description:
        "Publish one exact approval-controlled public or unlisted text status.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1, maxLength: 500 },
          visibility: { type: "string", enum: ["public", "unlisted"] },
          language: { type: "string", pattern: "^[a-z]{2}$" },
          approvalId: { type: "string", minLength: 1, maxLength: 128 },
        },
        required: ["text", "visibility"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "mastodon_safe",
      label: "Safe",
      description:
        "Account reads, bounded own-status reads and local drafts run automatically; exact text publishing requires approval.",
      defaultSelected: true,
      allowedActions: readsAndDraft,
      approvalRequiredActions: [publish],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected Mastodon actions run without Relay per-action approval; exact instance/account authority, bounds, idempotency, audits and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDraft, publish],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "verified_instance_and_account",
      label: "Verified public Mastodon instance and exact local account",
      requiredScopes: MASTODON_SCOPES,
    },
  ],
};
