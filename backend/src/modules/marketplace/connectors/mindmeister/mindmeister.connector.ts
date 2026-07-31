import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { MINDMEISTER_READ_OPERATIONS, MINDMEISTER_WRITE_OPERATIONS } from "./mindmeister-api.adapter";

const reads = [action("mindmeister_api_read", "Read MindMeister data", "Use an exact supported read-only MindMeister v2 route or OAuth-compatible v1 method.")];
const writes = [action("mindmeister_api_write", "Change MindMeister data", "Create, import, organize, share, publish, delete, or administer supported MindMeister resources.")];

export const MINDMEISTER_SCOPES = ["userinfo.profile", "userinfo.email", "mindmeister"] as const;

export const MINDMEISTER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mindmeister",
  name: "MindMeister",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.mindmeister.com/",
  providerWebsiteUrl: "https://www.mindmeister.com/",
  capabilities: [
    { ...capability("maps_read", "Read maps and exports", "List and inspect maps, map rights, presentations, attachments, images, and supported document exports.", true), platformCapability: "mindmeister_maps_read" },
    { ...capability("maps_manage", "Create and organize maps", "Create, duplicate, import, move, rename, revise, publish, unpublish, and delete maps and folders.", true), platformCapability: "mindmeister_maps_manage" },
    { ...capability("sharing_manage", "Manage collaboration", "Inspect collaborators and manage map sharing, notifications, invitations, and public availability.", true), platformCapability: "mindmeister_sharing_manage" },
    { ...capability("team_admin", "Administer supported teams", "Use documented provisioning operations for eligible team accounts, including users, plans, status, and membership.", false), platformCapability: "mindmeister_team_admin" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.mindmeister.com/oauth2/authorize",
      tokenUrl: "https://www.mindmeister.com/oauth2/token",
      revocationUrl: "https://www.mindmeister.com/oauth2/revoke",
      userInfoUrl: "https://www.mindmeister.com/api/v2/users/me",
      requiredScopes: [...MINDMEISTER_SCOPES], optionalScopes: [], pkce: false, supportsRefresh: false,
    },
    credentialSchema: [
      { name: "MINDMEISTER_CLIENT_ID", label: "MindMeister OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay-owned MindMeister app client ID configured on Railway." },
      { name: "MINDMEISTER_CLIENT_SECRET", label: "MindMeister OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay-owned MindMeister app client secret stored only in Railway secret variables." },
    ],
  },
  tools: [
    { name: "mindmeister.read", functionName: "mindmeister_read", aliases: ["mindmeister.read", "mindmeister_read", "mindmeister_api_read"], capability: "maps_read", platformCapability: "mindmeister_maps_read", action: "read", approvalRequired: false, description: "Run one exact supported MindMeister profile, map, export, file, rights, collaborator, or team read.", inputSchema: { type: "object", properties: { operation: { type: "string", enum: MINDMEISTER_READ_OPERATIONS.map((item) => item.id) }, params: { type: "object" }, query: { type: "object" } }, required: ["operation"], additionalProperties: false } },
    { name: "mindmeister.write", functionName: "mindmeister_write", aliases: ["mindmeister.write", "mindmeister_write", "mindmeister_api_write"], capability: "maps_manage", platformCapability: "mindmeister_maps_manage", action: "write", approvalRequired: true, description: "Run one exact supported MindMeister map, folder, sharing, import, publishing, revision, or team mutation.", inputSchema: { type: "object", properties: { operation: { type: "string", enum: MINDMEISTER_WRITE_OPERATIONS.map((item) => item.id) }, params: { type: "object" }, query: { type: "object" }, approvalId: { type: "string" } }, required: ["operation"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "mindmeister_safe", label: "Safe", description: "Profile, map, export, attachment, rights, collaborator, and team reads run directly; every mutation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized MindMeister operation runs without Relay per-action approval; exact operation allowlists, fixed origins, bounds, audits, redaction, provider permissions, plan limits, and rate limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "current_user", label: "MindMeister OAuth token and connected-user validation", requiredScopes: ["userinfo.profile"] }],
};
