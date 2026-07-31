import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const LOOKBACK_SCOPES = ["openid", "offline", "mcp"] as const;
const read = action(
  "lookback_mcp_read",
  "Read Lookback research",
  "Use one live-discovered, verified non-mutating Lookback MCP tool with bounded arguments.",
);
const manage = blocked(
  "lookback_manage",
  "Change Lookback",
  "Projects, rounds, findings, reels, themes, participants, recordings, and every other mutation remain blocked.",
);

export const LOOKBACK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "lookback",
  name: "Lookback",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.lookback.io/en/articles/13793032-lookback-mcp",
  providerWebsiteUrl: "https://www.lookback.com/",
  capabilities: [
    {
      ...capability(
        "research_read",
        "Read user research",
        "Navigate authorized projects, rounds, recordings, goals, findings, tasks, notes, transcripts, and summaries through verified read-only hosted-MCP tools.",
        true,
      ),
      platformCapability: "lookback_research_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://hydra.svc.production.lookback.io/oauth2/auth",
      tokenUrl: "https://hydra.svc.production.lookback.io/oauth2/token",
      userInfoUrl: "https://mcp.lookback.io/mcp",
      requiredScopes: [...LOOKBACK_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "LOOKBACK_MCP_CLIENT_ID",
        label: "Lookback MCP OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay's dynamically registered PKCE client ID for Lookback's official hosted MCP.",
      },
      {
        name: "LOOKBACK_MCP_CLIENT_SECRET",
        label: "Lookback MCP OAuth client secret",
        required: false,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Optional secret if Lookback dynamic registration issues a confidential client.",
      },
    ],
  },
  tools: [
    {
      name: "lookback.read",
      functionName: "lookback_mcp_read",
      aliases: ["lookback.read", "lookback_mcp_read"],
      capability: "research_read",
      platformCapability: "lookback_research_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one live-discovered, verifiably non-mutating Lookback MCP tool with bounded arguments.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", minLength: 1, maxLength: 160 },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "lookback_safe",
      label: "Safe",
      description:
        "Live-discovered read-only research tools run directly; mutating names and descriptions, unsafe annotations, credential arguments, and every write remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_read_only_mcp_tools",
      label: "Lookback OAuth and read-only hosted MCP capability check",
      requiredScopes: [...LOOKBACK_SCOPES],
    },
  ],
};
