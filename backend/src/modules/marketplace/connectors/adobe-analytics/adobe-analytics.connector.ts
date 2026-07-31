import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { ADOBE_ANALYTICS_READ_TOOLS } from "./adobe-analytics-mcp.adapter";

export const ADOBE_ANALYTICS_SCOPES = [
  "openid",
  "AdobeID",
  "additional_info.projectedProductContext",
] as const;

const reads = action(
  "adobe_analytics_read",
  "Read Adobe Analytics",
  "Discover permitted companies, report suites, components, and projects or run a bounded read-only report through Adobe's hosted MCP.",
);
const writes = blocked(
  "adobe_analytics_manage",
  "Change Adobe Analytics",
  "Session-default changes, segments, calculated metrics, date ranges, workspace projects, report-suite administration, ingestion, scheduling, and every mutation are unavailable.",
);

export const ADOBE_ANALYTICS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "adobe-analytics",
    name: "Adobe Analytics",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.adobe.com/analytics-mcp/docs/aa/",
    providerWebsiteUrl:
      "https://business.adobe.com/products/analytics/adobe-analytics.html",
    capabilities: [
      {
        ...capability(
          "analytics_read",
          "Read analytics",
          "Discover authorized Analytics components and run bounded read-only reports.",
          true,
        ),
        platformCapability: "adobe_analytics_read",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://ims-na1.adobelogin.com/ims/authorize/v2",
        tokenUrl: "https://ims-na1.adobelogin.com/ims/token/v3",
        userInfoUrl: "https://aa-mcp.adobe.io/mcp",
        requiredScopes: [...ADOBE_ANALYTICS_SCOPES],
        optionalScopes: [],
        pkce: true,
        supportsRefresh: false,
      },
      credentialSchema: [
        {
          name: "ADOBE_ANALYTICS_MCP_CLIENT_ID",
          label: "Adobe Analytics MCP OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Relay's dynamically registered public PKCE client ID, configured on Railway.",
        },
      ],
    },
    tools: [
      {
        name: "adobe-analytics.read",
        functionName: "adobe_analytics_read",
        aliases: ["adobe-analytics.read", "adobe_analytics_read"],
        capability: "analytics_read",
        platformCapability: "adobe_analytics_read",
        action: "read",
        approvalRequired: false,
        description:
          "Invoke one exact documented Adobe Analytics MCP read or reporting tool after live schema discovery.",
        inputSchema: {
          type: "object",
          properties: {
            toolName: { type: "string", enum: [...ADOBE_ANALYTICS_READ_TOOLS] },
            arguments: { type: "object" },
          },
          required: ["toolName", "arguments"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "adobe_analytics_safe",
        label: "Safe",
        description:
          "Documented discovery and bounded reporting reads run directly. Component, project, session, administrative, and ingestion mutations remain blocked.",
        defaultSelected: true,
        allowedActions: [reads],
        approvalRequiredActions: [],
        blockedActions: [writes],
      },
    ],
    healthChecks: [
      {
        id: "oauth_and_mcp_tools",
        label: "Adobe OAuth and exact read-only MCP capability check",
        requiredScopes: [...ADOBE_ANALYTICS_SCOPES],
      },
    ],
  };
