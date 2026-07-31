import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "canto_read",
    "Read Canto data",
    "Run one bounded GET operation in the connected Canto account.",
  ),
];
const writes = [
  action(
    "canto_manage",
    "Change Canto data",
    "Run one documented Canto mutation; Safe mode requires approval.",
  ),
];
const blocked = [
  action(
    "canto_secret_exposure",
    "Expose credentials",
    "OAuth credentials and signed provider URLs never enter agent-visible results.",
  ),
  action(
    "canto_untrusted_origin",
    "Call another origin",
    "Requests remain pinned to the connected HTTPS Canto account.",
  ),
  action(
    "canto_unbounded_transfer",
    "Transfer unbounded data",
    "Requests and responses remain inside Relay's bounded envelopes.",
  ),
];

const requestProperties = {
  path: { type: "string", minLength: 7, maxLength: 3000, pattern: "^/api/v1/" },
  query: { type: "object" },
};

export const CANTO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "canto",
  name: "Canto",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.canto.com/",
  providerWebsiteUrl: "https://www.canto.com/",
  capabilities: [
    {
      ...capability(
        "dam_read",
        "Browse digital assets",
        "Search and read authorized assets, folders, albums, metadata, users, comments, shares, and library structure.",
        true,
      ),
      platformCapability: "canto_dam_read",
    },
    {
      ...capability(
        "dam_manage",
        "Manage digital assets",
        "Create and change authorized assets, versions, folders, albums, metadata, tags, keywords, relations, comments, shares, and assignments.",
        true,
      ),
      platformCapability: "canto_dam_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://oauth.canto.{region}/oauth/api/oauth2/authorize",
      tokenUrl:
        "https://oauth.canto.{region}/oauth/api/oauth2/compatible/token",
      userInfoUrl: "https://{customer-account}/api/v1/user",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "CANTO_ACCOUNT_DOMAIN",
        label: "Canto account",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Your Canto account hostname, such as acme.canto.com.",
      },
      {
        name: "CANTO_CLIENT_ID",
        label: "App ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Create an API key in Canto and copy its App ID.",
      },
      {
        name: "CANTO_CLIENT_SECRET",
        label: "App secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Copy the App Secret from the same Canto API key.",
      },
    ],
  },
  tools: [
    {
      name: "canto.read",
      functionName: "canto_read",
      aliases: ["canto.read", "canto_read"],
      capability: "dam_read",
      platformCapability: "canto_dam_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one bounded GET against a documented Canto V1 API path.",
      inputSchema: {
        type: "object",
        properties: requestProperties,
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "canto.manage",
      functionName: "canto_manage",
      aliases: ["canto.manage", "canto_manage"],
      capability: "dam_manage",
      platformCapability: "canto_dam_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one documented mutation in the connected Canto account.",
      inputSchema: {
        type: "object",
        properties: {
          ...requestProperties,
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          json: {},
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "canto_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected account-authorized operation runs without Relay per-action approval; fixed authority, bounds, redaction, audits, rate limits, and provider enforcement still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label: "Canto OAuth token and connected-user validation",
    },
  ],
};
