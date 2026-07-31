import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "mixcloud_read",
  "Read Mixcloud",
  "Read one bounded official Mixcloud object, connection, list, search, or authenticated-user resource.",
);
const engage = action(
  "mixcloud_engage",
  "Manage Mixcloud engagement",
  "Follow a user or favorite, repost, or add one show to listen later; Safe mode requires approval.",
);
const upload = action(
  "mixcloud_upload",
  "Manage Mixcloud uploads",
  "Upload or edit one cloudcast and its supported metadata; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "mixcloud_secret_exposure",
    "Expose Mixcloud secrets",
    "OAuth client secrets, access tokens, cookies, and authorization data are never exposed.",
  ),
  blocked(
    "mixcloud_audio_streams",
    "Retrieve Mixcloud audio streams",
    "Mixcloud's API explicitly does not expose audio stream URLs; downloading, scraping, and private playback interfaces are blocked.",
  ),
  blocked(
    "mixcloud_arbitrary_interface",
    "Use arbitrary Mixcloud interfaces",
    "Relay accepts only canonical object keys on api.mixcloud.com and the documented engagement, upload, and edit suffixes.",
  ),
  blocked(
    "mixcloud_unbounded_transfer",
    "Transfer unbounded Mixcloud data",
    "Reads are one bounded page, responses are capped at 5 MB, audio uploads at 25 MB, and pictures at 10 MB.",
  ),
];

export const MIXCLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mixcloud",
  name: "Mixcloud",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.mixcloud.com/developers/",
  providerWebsiteUrl: "https://www.mixcloud.com/",
  capabilities: [
    {
      ...capability(
        "mixcloud_read",
        "Read Mixcloud resources",
        "Read API-visible users, shows, tags, cities, connections, lists, search results, and the authenticated user.",
        true,
      ),
      platformCapability: "mixcloud_read",
    },
    {
      ...capability(
        "mixcloud_engage",
        "Manage Mixcloud engagement",
        "Follow users and add or remove favorites, reposts, and listen-later entries.",
        true,
      ),
      platformCapability: "mixcloud_engage",
    },
    {
      ...capability(
        "mixcloud_upload",
        "Manage Mixcloud uploads",
        "Upload one bounded MP3 with supported metadata or edit an existing cloudcast.",
        true,
      ),
      platformCapability: "mixcloud_upload",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.mixcloud.com/oauth/authorize",
      tokenUrl: "https://www.mixcloud.com/oauth/access_token",
      userInfoUrl: "https://api.mixcloud.com/me/",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "MIXCLOUD_CLIENT_ID",
        label: "Mixcloud client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned OAuth application client ID issued after application registration.",
      },
      {
        name: "MIXCLOUD_CLIENT_SECRET",
        label: "Mixcloud client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned OAuth client secret stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "mixcloud.read",
      functionName: "mixcloud_read",
      aliases: ["mixcloud.read", "mixcloud_read"],
      capability: "mixcloud_read",
      platformCapability: "mixcloud_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one canonical Mixcloud API key with bounded query data.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", maxLength: 300 },
          query: { type: "object", maxProperties: 20 },
        },
        required: ["key"],
        additionalProperties: false,
      },
    },
    {
      name: "mixcloud.engage",
      functionName: "mixcloud_engage",
      aliases: ["mixcloud.engage", "mixcloud_engage"],
      capability: "mixcloud_engage",
      platformCapability: "mixcloud_engage",
      action: "write",
      approvalRequired: true,
      description:
        "Add or remove one documented engagement; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", maxLength: 300 },
          action: {
            type: "string",
            enum: ["follow", "favorite", "repost", "listen-later"],
          },
          operation: { type: "string", enum: ["add", "remove"] },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["key", "action", "operation"],
        additionalProperties: false,
      },
    },
    {
      name: "mixcloud.upload",
      functionName: "mixcloud_upload",
      aliases: ["mixcloud.upload", "mixcloud_upload"],
      capability: "mixcloud_upload",
      platformCapability: "mixcloud_upload",
      action: "write",
      approvalRequired: true,
      description: "Upload or edit one cloudcast; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["upload", "edit"] },
          key: { type: "string", maxLength: 300 },
          base64: { type: "string", maxLength: 35_000_000 },
          fileName: { type: "string", maxLength: 250 },
          pictureBase64: { type: "string", maxLength: 14_000_000 },
          pictureFileName: { type: "string", maxLength: 250 },
          fields: { type: "object", maxProperties: 100 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "mixcloud_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every engagement, upload, and edit requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [engage, upload],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected OAuth-authorized writes run without Relay per-action approval; specific intent, provider authority, bounds, fixed origins, audits, and provider rules still apply.",
      defaultSelected: false,
      allowedActions: [read, engage, upload],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "authenticated_user",
      label: "Mixcloud authenticated-user validation",
      requiredScopes: [],
    },
  ],
};
