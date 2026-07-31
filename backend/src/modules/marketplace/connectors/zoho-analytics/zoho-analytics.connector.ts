import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "zoho_analytics_workspace_list",
    "List Analytics workspaces",
    "List bounded accessible workspace summaries.",
  ),
  action(
    "zoho_analytics_view_list",
    "List workspace views",
    "List bounded view summaries for one exact organization and workspace.",
  ),
];

export const ZOHO_ANALYTICS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-analytics",
  name: "Zoho Analytics",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.zoho.com/analytics/api/v2/",
  providerWebsiteUrl: "https://www.zoho.com/analytics/",
  capabilities: [
    {
      ...capability(
        "analytics_metadata_read",
        "Read Analytics workspace metadata",
        "Read bounded workspace and view identity metadata without rows, columns, creator identities, exports, embeds, writes, or raw responses.",
        true,
      ),
      platformCapability: "zoho_analytics_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      revocationUrl: "https://accounts.zoho.com/oauth/v2/token/revoke",
      userInfoUrl: "https://accounts.zoho.com/oauth/user/info",
      requiredScopes: ["AaaServer.profile.Read", "ZohoAnalytics.metadata.read"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ZOHO_ANALYTICS_CLIENT_ID",
        label: "Zoho Analytics client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned multi-data-center Zoho web client ID configured on Railway.",
      },
      {
        name: "ZOHO_ANALYTICS_CLIENT_SECRET",
        label: "Zoho Analytics client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned shared multi-data-center Zoho client secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "zohoAnalytics.listWorkspaces",
      functionName: "zoho_analytics_workspace_list",
      aliases: [
        "zohoAnalytics.listWorkspaces",
        "zoho_analytics_workspace_list",
      ],
      capability: "analytics_metadata_read",
      platformCapability: "zoho_analytics_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five owned and shared workspaces with IDs, names, organization IDs, and ownership class only.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "zohoAnalytics.listViews",
      functionName: "zoho_analytics_view_list",
      aliases: ["zohoAnalytics.listViews", "zoho_analytics_view_list"],
      capability: "analytics_metadata_read",
      platformCapability: "zoho_analytics_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five view IDs, names, and types from one exact numeric organization and workspace.",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: { type: "string", pattern: "^[1-9][0-9]{0,24}$" },
          workspaceId: { type: "string", pattern: "^[1-9][0-9]{0,24}$" },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["organizationId", "workspaceId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoho_analytics_safe",
      label: "Safe",
      description:
        "Both bounded metadata reads require approval; business data, identities, exports, embeds, and mutations remain outside V1.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected metadata reads run without Relay per-action approval; exact user, regional origin, scope, bounds, audits, and exclusions remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user-region-and-metadata-scope",
      label:
        "Zoho current user, regional Analytics API, and metadata-read scope",
      requiredScopes: ["AaaServer.profile.Read", "ZohoAnalytics.metadata.read"],
    },
  ],
};
