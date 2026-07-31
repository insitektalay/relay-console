import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("lucidchart_api_read", "Read Lucidchart diagrams", "Use any supported read-only Lucid REST operation for Lucidchart diagrams, discussions, collaborators, share links, folders, and the connected profile."),
];
const writes = [
  action("lucidchart_api_write", "Change Lucidchart diagrams or access", "Create, copy, rename, move, classify, trash, comment on, share, or reorganize Lucidchart resources; Safe mode requires approval."),
];

export const LUCIDCHART_SCOPES = [
  "lucidchart.document.content",
  "folder",
  "user.profile",
  "offline_access",
] as const;

export const LUCIDCHART_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "lucidchart",
  name: "Lucidchart",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.lucid.co/reference/overview",
  providerWebsiteUrl: "https://lucid.co/product/lucidchart",
  capabilities: [
    { ...capability("diagram_read", "Read diagrams and discussions", "Search and inspect Lucidchart diagram metadata, structured canvas content, exports, comment threads, comments, collaborators, and share links.", true), platformCapability: "lucidchart_diagram_read" },
    { ...capability("diagram_management", "Create and organize diagrams", "Create, copy, rename, move, classify, and trash Lucidchart diagrams using Lucid's documented REST API.", true), platformCapability: "lucidchart_diagram_management" },
    { ...capability("collaboration", "Manage diagram collaboration", "Post comments and create, update, or remove user, team, and share-link access for Lucidchart diagrams.", true), platformCapability: "lucidchart_collaboration" },
    { ...capability("folder_management", "Organize folders", "Search, create, rename, move, trash, restore, and inspect folders used to organize Lucidchart diagrams.", true), platformCapability: "lucidchart_folder_management" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://lucid.app/oauth2/authorize",
      tokenUrl: "https://api.lucid.co/oauth2/token",
      refreshUrl: "https://api.lucid.co/oauth2/token",
      revocationUrl: "https://api.lucid.co/v1/oauth2/token/revoke",
      userInfoUrl: "https://api.lucid.co/v1/users/me/profile",
      requiredScopes: [...LUCIDCHART_SCOPES],
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
      name: "lucidchart.read",
      functionName: "lucidchart_read",
      aliases: ["lucidchart.read", "lucidchart_read", "lucidchart_api_read"],
      capability: "diagram_read",
      platformCapability: "lucidchart_diagram_read",
      action: "read",
      approvalRequired: false,
      description: "Call one exact supported read-only Lucid REST route for Lucidchart diagrams, discussions, collaborators, folders, or profile data.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST"] }, path: { type: "string", pattern: "^/v1/" }, query: { type: "object" }, json: { type: "object" }, accept: { type: "string", enum: ["application/json", "image/png", "image/jpeg"] } }, required: ["path"], additionalProperties: false },
    },
    {
      name: "lucidchart.write",
      functionName: "lucidchart_write",
      aliases: ["lucidchart.write", "lucidchart_write", "lucidchart_api_write"],
      capability: "diagram_management",
      platformCapability: "lucidchart_diagram_management",
      action: "write",
      approvalRequired: true,
      description: "Call one exact supported Lucidchart diagram, comment, sharing, collaborator, or folder mutation on Lucid's fixed API origin.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/v1/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false },
    },
  ],
  approvalProfiles: [
    { id: "lucidchart_safe", label: "Safe", description: "Diagram, discussion, collaborator, sharing, folder, and profile reads run directly; every creation, content import, comment, organization, sharing, access, or deletion mutation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Lucidchart REST operation runs without Relay per-action approval; fixed Lucid origins, exact route allowlists, product binding, request bounds, audits, redaction, provider permissions, plan limits, and rate limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "current_user", label: "Lucid OAuth token and current-user validation", requiredScopes: ["user.profile"] }],
};
