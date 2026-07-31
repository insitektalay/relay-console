import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MAZE_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;
const read = action(
  "maze_mcp_read",
  "Read Maze research",
  "Use one live-discovered, verified non-mutating Maze MCP tool with bounded arguments.",
);
const manage = blocked(
  "maze_manage",
  "Change Maze",
  "The official Maze MCP is read-only; all mutations and unverified tools remain blocked.",
);

export const MAZE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "maze",
  name: "Maze",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.maze.co/articles/3603930517-maze-mcp",
  providerWebsiteUrl: "https://maze.co/",
  capabilities: [
    {
      ...capability(
        "research_read",
        "Read product research",
        "Search authorized studies and read study details, results, task metrics, themes, highlights, responses, and transcripts through Maze's official read-only hosted MCP.",
        true,
      ),
      platformCapability: "maze_research_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://resolute-time-87.authkit.app/oauth2/authorize",
      tokenUrl: "https://resolute-time-87.authkit.app/oauth2/token",
      userInfoUrl: "https://connect.maze.co/mcp",
      requiredScopes: [...MAZE_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MAZE_MCP_CLIENT_ID",
        label: "Maze MCP OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay's dynamically registered public PKCE client ID for Maze's official hosted MCP.",
      },
      {
        name: "MAZE_MCP_CLIENT_SECRET",
        label: "Maze MCP OAuth client secret",
        required: false,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Optional secret if Maze's dynamic registration issues a confidential client.",
      },
    ],
  },
  tools: [
    {
      name: "maze.read",
      functionName: "maze_mcp_read",
      aliases: ["maze.read", "maze_mcp_read"],
      capability: "research_read",
      platformCapability: "maze_research_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one live-discovered, verifiably non-mutating Maze MCP tool with bounded arguments.",
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
      id: "maze_safe",
      label: "Safe",
      description:
        "Live-discovered read-only research tools run directly; mutating names, non-read-only annotations, credentials in arguments, and all writes remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_read_only_mcp_tools",
      label: "Maze OAuth and read-only hosted MCP capability check",
      requiredScopes: [...MAZE_SCOPES],
    },
  ],
};
