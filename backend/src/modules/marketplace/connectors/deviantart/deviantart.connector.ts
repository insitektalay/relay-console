import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const read = action(
  "deviantart_read",
  "Read DeviantArt",
  "Run one allowlisted official read endpoint.",
);
const manage = action(
  "deviantart_manage",
  "Manage DeviantArt",
  "Run one allowlisted official mutation; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "deviantart_secret_exposure",
    "Expose DeviantArt secrets",
    "OAuth client secrets, access and refresh tokens, cookies, and authorization headers are never exposed.",
  ),
  blocked(
    "deviantart_unofficial_interface",
    "Use unofficial DeviantArt interfaces",
    "Scraping, browser automation, arbitrary endpoints, private application calls, and raw token parameters are blocked.",
  ),
  blocked(
    "deviantart_unbounded_transfer",
    "Transfer unbounded content",
    "Requests are bounded to one allowlisted endpoint, pages to 50, bodies to 2 MB, and responses to 5 MB.",
  ),
];
export const DEVIANTART_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "deviantart",
  name: "DeviantArt",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.deviantart.com/developers/",
  providerWebsiteUrl: "https://www.deviantart.com/",
  capabilities: [
    {
      ...capability(
        "deviantart_read",
        "Read DeviantArt resources",
        "Read the complete documented browse, collection, comment, data, deviation, feed, gallery, message, note, and user surface.",
        true,
      ),
      platformCapability: "deviantart_read",
    },
    {
      ...capability(
        "deviantart_manage",
        "Manage DeviantArt resources",
        "Manage collections, comments, deviations, feed settings, galleries, messages, notes, Sta.sh publishing, watches, profiles, and statuses.",
        true,
      ),
      platformCapability: "deviantart_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.deviantart.com/oauth2/authorize",
      tokenUrl: "https://www.deviantart.com/oauth2/token",
      userInfoUrl: "https://www.deviantart.com/api/v1/oauth2/user/whoami",
      requiredScopes: [
        "basic",
        "browse",
        "collection",
        "comment.post",
        "feed",
        "gallery",
        "message",
        "note",
        "stash",
        "user",
        "user.manage",
      ],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "DEVIANTART_CLIENT_ID",
        label: "DeviantArt client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned OAuth application client ID issued by DeviantArt.",
      },
      {
        name: "DEVIANTART_CLIENT_SECRET",
        label: "DeviantArt client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential-client secret stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "deviantart.read",
      functionName: "deviantart_read",
      aliases: ["deviantart.read", "deviantart_read"],
      capability: "deviantart_read",
      platformCapability: "deviantart_read",
      action: "read",
      approvalRequired: false,
      description: "Run one allowlisted DeviantArt GET endpoint.",
      inputSchema: schema(false),
    },
    {
      name: "deviantart.manage",
      functionName: "deviantart_manage",
      aliases: ["deviantart.manage", "deviantart_manage"],
      capability: "deviantart_manage",
      platformCapability: "deviantart_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one allowlisted DeviantArt POST endpoint; Safe mode requires approval.",
      inputSchema: schema(true),
    },
  ],
  approvalProfiles: [
    {
      id: "deviantart_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected OAuth-authorized mutations run without Relay per-action approval; provider authority, fixed origins, allowlisted routes, bounds, audits, redaction, and provider rules still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "whoami",
      label: "DeviantArt authenticated-user validation",
      requiredScopes: ["basic"],
    },
  ],
};
function schema(approval: boolean) {
  return {
    type: "object",
    properties: {
      route: { type: "string", pattern: "^/[A-Za-z0-9_/-]+$", maxLength: 300 },
      parameters: { type: "object", maxProperties: 80 },
      ...(approval ? { approvalId: { type: "string", maxLength: 200 } } : {}),
    },
    required: ["route"],
    additionalProperties: false,
  };
}
