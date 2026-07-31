import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const NEXTDOOR_SCOPES = [
  "openid",
  "profile:read",
  "post:read",
  "post:write",
];

const readsAndDraft = [
  action(
    "nextdoor_profile_get",
    "Read selected profile",
    "Inspect the server-bound verified neighbor or business profile.",
  ),
  action(
    "nextdoor_own_posts_list",
    "List own posts",
    "List at most ten posts owned by the selected profile.",
  ),
  action(
    "nextdoor_text_post_draft",
    "Draft text post",
    "Draft plain text locally without provider side effects.",
  ),
];
const publish = [
  action(
    "nextdoor_text_post_publish",
    "Publish text post",
    "Create one exact plain-text post for the selected profile.",
  ),
];
const blockedActions = [
  blocked(
    "nextdoor_cross_product",
    "Block other Nextdoor products",
    "Display Content, Ads/CAPI, Share Plugin, and agency APIs are separate products and are not exposed.",
  ),
  blocked(
    "nextdoor_broad_social",
    "Block broad social actions",
    "Comments, events, FSF, media, geo, bulk, scheduling, edit/delete, pagination, export, and raw APIs are blocked.",
  ),
  blocked(
    "nextdoor_secret_exposure",
    "Block secret exposure",
    "OAuth client and token material never leaves Railway.",
  ),
];

export const NEXTDOOR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "nextdoor",
  name: "Nextdoor",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.nextdoor.com/reference/sharing-introduction",
  providerWebsiteUrl: "https://nextdoor.com",
  capabilities: [
    {
      ...capability(
        "profile_read",
        "Read selected profile",
        "Inspect one verified neighbor or business profile.",
        true,
      ),
      platformCapability: "profile_read",
    },
    {
      ...capability(
        "own_posts_read",
        "Read own posts",
        "Read at most ten posts owned by the selected profile.",
        true,
      ),
      platformCapability: "own_posts_read",
    },
    {
      ...capability(
        "text_post_draft",
        "Draft plain text",
        "Draft one post locally.",
        true,
      ),
      platformCapability: "text_post_draft",
    },
    {
      ...capability(
        "text_post_publish",
        "Publish plain text",
        "Publish one approval-controlled post.",
        true,
      ),
      platformCapability: "text_post_publish",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.nextdoor.com/v3/authorize/",
      tokenUrl: "https://auth.nextdoor.com/v2/token",
      userInfoUrl: "https://nextdoor.com/external/api/partner/v1/me/profiles",
      requiredScopes: NEXTDOOR_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "NEXTDOOR_CLIENT_ID",
        label: "Nextdoor partner client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held client issued after Publish API partner approval.",
      },
      {
        name: "NEXTDOOR_CLIENT_SECRET",
        label: "Nextdoor partner client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held confidential secret; never entered in RelayConsoleSwift.",
      },
    ],
  },
  tools: [
    {
      name: "relay_nextdoor_get_profile",
      functionName: "relay_nextdoor_get_profile",
      aliases: ["nextdoor_profile_get"],
      capability: "profile_read",
      platformCapability: "profile_read",
      action: "read",
      approvalRequired: false,
      description: "Read the selected verified profile.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_nextdoor_list_own_posts",
      functionName: "relay_nextdoor_list_own_posts",
      aliases: ["nextdoor_own_posts_list"],
      capability: "own_posts_read",
      platformCapability: "own_posts_read",
      action: "read",
      approvalRequired: false,
      description: "List at most ten own posts.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_nextdoor_draft_text_post",
      functionName: "relay_nextdoor_draft_text_post",
      aliases: ["nextdoor_text_post_draft"],
      capability: "text_post_draft",
      platformCapability: "text_post_draft",
      action: "draft",
      approvalRequired: false,
      description: "Draft plain text locally.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", minLength: 1, maxLength: 8192 } },
        required: ["text"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_nextdoor_publish_text_post",
      functionName: "relay_nextdoor_publish_text_post",
      aliases: ["nextdoor_text_post_publish"],
      capability: "text_post_publish",
      platformCapability: "text_post_publish",
      action: "write",
      approvalRequired: true,
      description: "Publish one exact approval-controlled plain-text post.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1, maxLength: 8192 },
          approvalId: { type: "string" },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "nextdoor_safe",
      label: "Safe",
      description:
        "Reads and local drafts execute; publishing exact plain text requires approval.",
      defaultSelected: true,
      allowedActions: readsAndDraft,
      approvalRequiredActions: publish,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected Nextdoor actions execute without Relay per-action approval and remain audited.",
      defaultSelected: false,
      allowedActions: [...readsAndDraft, ...publish],
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "nextdoor_read_only",
      label: "Read only",
      description: "Only selected-profile and own-post reads are enabled.",
      defaultSelected: false,
      allowedActions: readsAndDraft.slice(0, 2),
      approvalRequiredActions: [],
      blockedActions: [...blockedActions, ...publish],
    },
    {
      id: "nextdoor_no_access",
      label: "No access",
      description: "All Nextdoor actions are blocked.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [...blockedActions, ...readsAndDraft, ...publish],
    },
  ],
  healthChecks: [
    {
      id: "selected_profile",
      label: "Selected verified profile and OAuth refresh",
      requiredScopes: NEXTDOOR_SCOPES,
    },
  ],
};
