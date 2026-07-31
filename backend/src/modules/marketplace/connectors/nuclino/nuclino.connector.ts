import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { NUCLINO_READ_TOOLS, NUCLINO_WRITE_TOOLS } from "./nuclino-mcp.adapter";

const reads = [
  action(
    "nuclino_mcp_read",
    "Use read tools",
    "Use one of Nuclino's documented read-only MCP tools with bounded arguments.",
  ),
];
const writes = [
  action(
    "nuclino_mcp_write",
    "Use write tools",
    "Use one of Nuclino's documented mutation MCP tools; Safe mode requires approval.",
  ),
];

export const NUCLINO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "nuclino",
  name: "Nuclino",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.nuclino.com/70af7f4f-connect-nuclino-to-ai-assistants-with-mcp",
  providerWebsiteUrl: "https://www.nuclino.com/",
  capabilities: [
    {
      ...capability(
        "knowledge_read",
        "Read workspace knowledge",
        "List teams and workspaces, search and read items, and retrieve attached-file metadata.",
        true,
      ),
      platformCapability: "nuclino_knowledge_read",
    },
    {
      ...capability(
        "knowledge_write",
        "Create and maintain knowledge",
        "Create, update, edit, or trash items and collections and manage workspace fields.",
        true,
      ),
      platformCapability: "nuclino_knowledge_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.nuclino.com/oauth/authorize",
      tokenUrl: "https://api.nuclino.com/oauth/token",
      userInfoUrl: "https://api.nuclino.com/mcp",
      requiredScopes: [],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "NUCLINO_CLIENT_ID",
        label: "Nuclino OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay's dynamically registered public PKCE client ID, configured on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "nuclino.read",
      functionName: "nuclino_read",
      aliases: ["nuclino.read", "nuclino_read", "nuclino_mcp_read"],
      capability: "knowledge_read",
      platformCapability: "nuclino_knowledge_read",
      action: "read",
      approvalRequired: false,
      description: "Invoke one exact documented Nuclino MCP read tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...NUCLINO_READ_TOOLS] },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "nuclino.write",
      functionName: "nuclino_write",
      aliases: ["nuclino.write", "nuclino_write", "nuclino_mcp_write"],
      capability: "knowledge_write",
      platformCapability: "nuclino_knowledge_write",
      action: "write",
      approvalRequired: true,
      description: "Invoke one exact documented Nuclino MCP mutation tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...NUCLINO_WRITE_TOOLS] },
          arguments: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "nuclino_safe",
      label: "Safe",
      description: "Documented reads run directly; every create, update, edit, trash, or field mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Every selected OAuth-authorized Nuclino MCP operation runs without Relay per-action approval; ownership, provider permissions, exact tool allowlists, bounds, audits, schema validation, and rate limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Nuclino OAuth and documented MCP capability check",
      requiredScopes: [],
    },
  ],
};
