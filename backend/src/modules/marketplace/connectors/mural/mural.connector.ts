import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("mural_api_read", "Read Mural workspaces and canvases", "Use any current documented Mural public API read operation."),
];
const writes = [
  action("mural_api_write", "Change Mural workspaces and canvases", "Use any current documented Mural public API mutation; Safe mode requires approval."),
];

export const MURAL_SCOPES = [
  "identity:read",
  "workspaces:read",
  "workspaces:write",
  "rooms:read",
  "rooms:write",
  "murals:read",
  "murals:write",
  "templates:read",
  "templates:write",
  "users:read",
] as const;

export const MURAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mural",
  name: "Mural",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.mural.co/public/reference",
  providerWebsiteUrl: "https://www.mural.co/",
  capabilities: [
    { ...capability("collaboration_read", "Read collaboration spaces", "Read the connected user, workspaces, rooms, murals, widgets, chat, tags, timers, voting sessions, users, templates, search results, and exports.", true), platformCapability: "mural_collaboration_read" },
    { ...capability("collaboration_write", "Create and edit collaboration content", "Create, update, duplicate, export, and delete rooms, murals, folders, templates, tags, and every supported widget type.", true), platformCapability: "mural_collaboration_write" },
    { ...capability("facilitation", "Run collaborative sessions", "Manage private mode, timers, voting sessions, comments, access requests, and visitor settings.", true), platformCapability: "mural_facilitation" },
    { ...capability("access_management", "Manage collaborators and access", "Invite or remove users and update workspace, room, mural, and visitor permissions authorized by Mural.", true), platformCapability: "mural_access_management" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.mural.co/api/public/v1/authorization/oauth2/",
      tokenUrl: "https://app.mural.co/api/public/v1/authorization/oauth2/token",
      userInfoUrl: "https://app.mural.co/api/public/v1/users/me",
      requiredScopes: [...MURAL_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      { name: "MURAL_CLIENT_ID", label: "Mural OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay-owned Mural app client ID configured on Railway." },
      { name: "MURAL_CLIENT_SECRET", label: "Mural OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay-owned Mural app client secret stored only in Railway secret variables." },
    ],
  },
  tools: [
    {
      name: "mural.read",
      functionName: "mural_read",
      aliases: ["mural.read", "mural_read", "mural_api_read"],
      capability: "collaboration_read",
      platformCapability: "mural_collaboration_read",
      action: "read",
      approvalRequired: false,
      description: "Call one exact documented GET path on Mural's fixed public API origin.",
      inputSchema: { type: "object", properties: { path: { type: "string", pattern: "^/" }, query: { type: "object" } }, required: ["path"], additionalProperties: false },
    },
    {
      name: "mural.write",
      functionName: "mural_write",
      aliases: ["mural.write", "mural_write", "mural_api_write"],
      capability: "collaboration_write",
      platformCapability: "mural_collaboration_write",
      action: "write",
      approvalRequired: true,
      description: "Call one exact documented POST, PATCH, or DELETE path on Mural's fixed public API origin.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["POST", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false },
    },
  ],
  approvalProfiles: [
    { id: "mural_safe", label: "Safe", description: "Every documented Mural read runs directly; creation, editing, facilitation, sharing, permission, invitation, removal, and deletion operations require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Mural public API operation runs without Relay per-action approval; fixed origins, exact route allowlists, request bounds, audits, redaction, provider permissions, plan limits, and Mural enforcement still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "connected_member", label: "Mural OAuth token and connected-member validation" }],
};
