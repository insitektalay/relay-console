import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "audius_read",
  "Read Audius",
  "Read one bounded official Audius content or social API route.",
);
const manage = action(
  "audius_manage",
  "Manage Audius",
  "Run one OAuth-authorized content or social mutation; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "audius_secret_exposure",
    "Expose Audius secrets",
    "API keys, access and refresh tokens, bearer headers, wallet material, and private keys are never exposed.",
  ),
  blocked(
    "audius_financial_authority",
    "Use financial or authorization-admin routes",
    "Coins, wallets, tips, rewards, prizes, grants, authorized-app administration, DMs, and messaging remain blocked.",
  ),
  blocked(
    "audius_media_transfer",
    "Transfer Audius media",
    "Stream and download routes, arbitrary binary transfers, and unbounded uploads are not exposed by these wrappers.",
  ),
  blocked(
    "audius_arbitrary_interface",
    "Use arbitrary Audius interfaces",
    "Relay fixes calls to api.audius.co/v1 and allows only bounded content and social resource roots.",
  ),
];

export const AUDIUS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "audius",
  name: "Audius",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.audius.co/api/",
  providerWebsiteUrl: "https://audius.co/",
  capabilities: [
    {
      ...capability(
        "audius_read",
        "Read Audius content and social resources",
        "Read users, tracks, playlists, comments, resolve results, discovery data, and the authorized profile.",
        true,
      ),
      platformCapability: "audius_read",
    },
    {
      ...capability(
        "audius_manage",
        "Manage Audius content and social resources",
        "Run write-scoped user, track, playlist, and comment mutations without financial, wallet, grant, or messaging authority.",
        true,
      ),
      platformCapability: "audius_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.audius.co/v1/oauth/authorize",
      tokenUrl: "https://api.audius.co/v1/oauth/token",
      refreshUrl: "https://api.audius.co/v1/oauth/token",
      revocationUrl: "https://api.audius.co/v1/oauth/revoke",
      userInfoUrl: "https://api.audius.co/v1/me",
      requiredScopes: ["write"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "AUDIUS_API_KEY",
        label: "Audius API key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned Audius developer application API key used as the public OAuth client ID.",
      },
    ],
  },
  tools: [
    {
      name: "audius.read",
      functionName: "audius_read",
      aliases: ["audius.read", "audius_read"],
      capability: "audius_read",
      platformCapability: "audius_read",
      action: "read",
      approvalRequired: false,
      description: "Read one bounded allowlisted Audius content/social path.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", maxLength: 500 },
          query: { type: "object", maxProperties: 30 },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "audius.manage",
      functionName: "audius_manage",
      aliases: ["audius.manage", "audius_manage"],
      capability: "audius_manage",
      platformCapability: "audius_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one bounded allowlisted Audius content/social mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "PATCH", "DELETE"] },
          path: { type: "string", maxLength: 500 },
          json: { type: "object", maxProperties: 100 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "audius_safe",
      label: "Safe",
      description:
        "Bounded content and social reads run directly; every mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected write-scoped content/social mutations run without Relay per-action approval; fixed origins, bounded routes, audits, redaction, and provider rules still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "authenticated_user",
      label: "Audius authenticated-user validation",
      requiredScopes: ["write"],
    },
  ],
};
