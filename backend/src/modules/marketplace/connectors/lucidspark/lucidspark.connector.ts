import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("lucidspark_api_read", "Read Lucidspark boards", "Use any supported read-only Lucid REST operation for Lucidspark boards, discussions, collaborators, share links, folders, and the connected profile."),
];
const writes = [
  action("lucidspark_api_write", "Change Lucidspark boards or access", "Create, copy, rename, move, classify, trash, comment on, share, or reorganize Lucidspark resources; Safe mode requires approval."),
];

export const LUCIDSPARK_SCOPES = [
  "lucidspark.document.content",
  "folder",
  "user.profile",
  "offline_access",
] as const;

export const LUCIDSPARK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "lucidspark",
  name: "Lucidspark",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.lucid.co/reference/overview",
  providerWebsiteUrl: "https://lucidspark.com/",
  capabilities: [
    { ...capability("board_read", "Read boards and discussions", "Search and inspect Lucidspark board metadata, structured canvas content, exports, comment threads, comments, collaborators, and share links.", true), platformCapability: "lucidspark_board_read" },
    { ...capability("board_management", "Create and organize boards", "Create, copy, rename, move, classify, and trash Lucidspark boards using Lucid's documented REST API.", true), platformCapability: "lucidspark_board_management" },
    { ...capability("collaboration", "Manage board collaboration", "Post comments and create, update, or remove user, team, and share-link access for Lucidspark boards.", true), platformCapability: "lucidspark_collaboration" },
    { ...capability("folder_management", "Organize folders", "Search, create, rename, move, trash, restore, and inspect folders used to organize Lucidspark boards.", true), platformCapability: "lucidspark_folder_management" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://lucid.app/oauth2/authorize",
      tokenUrl: "https://api.lucid.co/oauth2/token",
      refreshUrl: "https://api.lucid.co/oauth2/token",
      revocationUrl: "https://api.lucid.co/v1/oauth2/token/revoke",
      userInfoUrl: "https://api.lucid.co/v1/users/me/profile",
      requiredScopes: [...LUCIDSPARK_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      { name: "LUCID_CLIENT_ID", label: "Lucid OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay-owned Lucid app client ID configured on Railway." },
      { name: "LUCID_CLIENT_SECRET", label: "Lucid OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay-owned Lucid app client secret stored only in Railway secret variables." },
    ],
  },
  tools: [
    {
      name: "lucidspark.read",
      functionName: "lucidspark_read",
      aliases: ["lucidspark.read", "lucidspark_read", "lucidspark_api_read"],
      capability: "board_read",
      platformCapability: "lucidspark_board_read",
      action: "read",
      approvalRequired: false,
      description: "Call one exact supported read-only Lucid REST route for Lucidspark boards, discussions, collaborators, folders, or profile data.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST"] }, path: { type: "string", pattern: "^/v1/" }, query: { type: "object" }, json: { type: "object" }, accept: { type: "string", enum: ["application/json", "image/png", "image/jpeg"] } }, required: ["path"], additionalProperties: false },
    },
    {
      name: "lucidspark.write",
      functionName: "lucidspark_write",
      aliases: ["lucidspark.write", "lucidspark_write", "lucidspark_api_write"],
      capability: "board_management",
      platformCapability: "lucidspark_board_management",
      action: "write",
      approvalRequired: true,
      description: "Call one exact supported Lucidspark board, comment, sharing, collaborator, or folder mutation on Lucid's fixed API origin.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/v1/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false },
    },
  ],
  approvalProfiles: [
    { id: "lucidspark_safe", label: "Safe", description: "Board, discussion, collaborator, sharing, folder, and profile reads run directly; every creation, content import, comment, organization, sharing, access, or deletion mutation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Lucidspark REST operation runs without Relay per-action approval; fixed Lucid origins, exact route allowlists, product binding, request bounds, audits, redaction, provider permissions, plan limits, and rate limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "current_user", label: "Lucid OAuth token and current-user validation", requiredScopes: ["user.profile"] }],
};
