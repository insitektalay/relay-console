import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { FIRSTPROMOTER_READ_OPERATIONS } from "./firstpromoter-mcp.adapter";

export const FIRSTPROMOTER_SCOPES = ["user", "mcp"] as const;
const read = action(
  "firstpromoter_read",
  "Read FirstPromoter analytics",
  "Read company context, dashboard statistics, dashboard trends, and campaign summaries through four pinned hosted-MCP tools.",
);
const manage = blocked(
  "firstpromoter_manage",
  "Change FirstPromoter",
  "Promoter, campaign, referral, commission, reward, promo-code, product, email, asset, contract, and every other mutation are outside Relay's V1 contract.",
);

export const FIRSTPROMOTER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "firstpromoter",
  name: "FirstPromoter",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.firstpromoter.com/mcp/overview",
  providerWebsiteUrl: "https://firstpromoter.com/",
  capabilities: [
    {
      ...capability(
        "firstpromoter_read",
        "Read affiliate-program analytics",
        "Use four pinned zero-argument hosted-MCP reads for company context, dashboard statistics, dashboard trends, and campaign summaries.",
        true,
      ),
      platformCapability: "firstpromoter_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://mcp.firstpromoter.com/oauth/authorize",
      tokenUrl: "https://mcp.firstpromoter.com/oauth/token",
      userInfoUrl: "https://mcp.firstpromoter.com",
      requiredScopes: [...FIRSTPROMOTER_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "FIRSTPROMOTER_MCP_CLIENT_ID",
        label: "FirstPromoter MCP OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay's dynamically registered public PKCE client ID for FirstPromoter's official hosted MCP.",
      },
    ],
  },
  tools: [
    {
      name: "firstPromoter.read",
      functionName: "firstpromoter_read",
      aliases: ["firstPromoter.read", "firstpromoter_read"],
      capability: "firstpromoter_read",
      platformCapability: "firstpromoter_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned zero-argument analytics read through FirstPromoter's hosted MCP.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...FIRSTPROMOTER_READ_OPERATIONS],
          },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "firstpromoter_safe",
      label: "Safe",
      description:
        "Four pinned analytics reads run directly. Identity searches, raw MCP tools, details, money movement, email bodies, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_pinned_analytics_schemas",
      label: "OAuth and four pinned analytics-tool schema checks",
      requiredScopes: [...FIRSTPROMOTER_SCOPES],
    },
  ],
};
