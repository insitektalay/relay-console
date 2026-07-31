import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { AUDIOMACK_OPERATIONS } from "./audiomack-operation-registry";

const read = action(
  "audiomack_read",
  "Read Audiomack",
  "Run one pinned bounded Audiomack music, artist, chart, search, playlist, or authorized-user read.",
);
const manage = action(
  "audiomack_manage",
  "Manage Audiomack",
  "Manage one favorite, repost, follow, playlist, notification, or pinned-content change; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "audiomack_secret_exposure",
    "Expose Audiomack secrets",
    "Consumer secrets, OAuth token pairs, cookies, and signed authorization headers are never exposed.",
  ),
  blocked(
    "audiomack_account_credentials",
    "Automate account or password flows",
    "API registration and forgot-password endpoints require raw passwords or email-triggering account actions and are not exposed.",
  ),
  blocked(
    "audiomack_play_manipulation",
    "Automate plays or retrieve streams",
    "Play-stat calls, preview audio, streaming URLs, artificial statistics, downloading, and private playback interfaces are blocked.",
  ),
  blocked(
    "audiomack_unbounded_transfer",
    "Transfer unbounded Audiomack data",
    "Every action is one pinned endpoint, pages are capped at 100, requests are bounded, and responses are capped at 5 MB.",
  ),
];

export const AUDIOMACK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "audiomack",
  name: "Audiomack",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://audiomack.com/data-api/docs",
  providerWebsiteUrl: "https://audiomack.com/",
  capabilities: [
    {
      ...capability(
        "audiomack_read",
        "Read Audiomack resources",
        "Read pinned music, artist, chart, search, playlist, metric, notification, and authorized-user resources.",
        true,
      ),
      platformCapability: "audiomack_read",
    },
    {
      ...capability(
        "audiomack_manage",
        "Manage Audiomack resources",
        "Manage favorites, reposts, follows, playlists, notification state, and the authorized artist's pinned content.",
        true,
      ),
      platformCapability: "audiomack_manage",
    },
  ],
  auth: {
    type: "oauth1",
    oauth: {
      authorizationUrl: "https://audiomack.com/oauth/authenticate",
      tokenUrl: "https://api.audiomack.com/v1/access_token",
      userInfoUrl: "https://api.audiomack.com/v1/user",
      requiredScopes: ["account_authority"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "AUDIOMACK_CONSUMER_KEY",
        label: "Audiomack consumer key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned OAuth consumer key issued by Audiomack.",
      },
      {
        name: "AUDIOMACK_CONSUMER_SECRET",
        label: "Audiomack consumer secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned OAuth consumer secret stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "audiomack.read",
      functionName: "audiomack_read",
      aliases: ["audiomack.read", "audiomack_read"],
      capability: "audiomack_read",
      platformCapability: "audiomack_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned Audiomack read operation.",
      inputSchema: operationSchema(false),
    },
    {
      name: "audiomack.manage",
      functionName: "audiomack_manage",
      aliases: ["audiomack.manage", "audiomack_manage"],
      capability: "audiomack_manage",
      platformCapability: "audiomack_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Audiomack mutation; Safe mode requires approval.",
      inputSchema: operationSchema(true),
    },
  ],
  approvalProfiles: [
    {
      id: "audiomack_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every favorite, repost, follow, playlist, notification, and pinned-content mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected OAuth-authorized mutations run without Relay per-action approval; specific intent, fixed endpoints, bounds, audits, redaction, and provider rules still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "authorized_user",
      label: "Audiomack authorized-user validation",
      requiredScopes: ["account_authority"],
    },
  ],
};

function operationSchema(manage: boolean) {
  return {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: AUDIOMACK_OPERATIONS.filter((item) =>
          manage ? item.method !== "GET" : item.method === "GET",
        ).map((item) => item.id),
      },
      path: { type: "object", maxProperties: 5 },
      query: { type: "object", maxProperties: 30 },
      body: manage
        ? {
            anyOf: [
              { type: "object", maxProperties: 40 },
              { type: "array", maxItems: 100 },
            ],
          }
        : { type: "object", maxProperties: 0 },
      ...(manage ? { approvalId: { type: "string", maxLength: 200 } } : {}),
    },
    required: ["operation"],
    additionalProperties: false,
  };
}
