import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "scribe_mcp_read",
  "Read Scribe knowledge",
  "Use one live-discovered, non-mutating Scribe MCP tool with bounded arguments.",
);

export const SCRIBE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "scribe",
  name: "Scribe",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://support.scribehow.com/hc/en-us/articles/35221245251485-Scribe-MCP-Server",
  providerWebsiteUrl: "https://scribehow.com/",
  capabilities: [
    {
      ...capability(
        "knowledge_read",
        "Search and read process knowledge",
        "Search and retrieve permitted Scribe documents, pages, teams, and screenshots.",
        true,
      ),
      platformCapability: "scribe_knowledge_read",
    },
    {
      ...capability(
        "workflow_insights",
        "Explore workflows and insights",
        "Explore permitted workflow hierarchies, execution history, friction points, and optimization recommendations.",
        true,
      ),
      platformCapability: "scribe_workflow_insights",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://mcp.scribe.com/authorize",
      tokenUrl: "https://mcp.scribe.com/token",
      userInfoUrl: "https://mcp.scribe.com/mcp",
      requiredScopes: [],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      { name: "SCRIBE_CLIENT_ID", label: "Scribe OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay's dynamically registered Scribe MCP client ID stored on Railway." },
      { name: "SCRIBE_CLIENT_SECRET", label: "Scribe OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay's dynamically registered Scribe MCP client secret stored only on Railway." },
    ],
  },
  tools: [
    {
      name: "scribe.read",
      functionName: "scribe_read",
      aliases: ["scribe.read", "scribe_read", "scribe_mcp_read"],
      capability: "knowledge_read",
      platformCapability: "scribe_knowledge_read",
      action: "read",
      approvalRequired: false,
      description: "Invoke one live-discovered non-mutating Scribe MCP tool after schema and safety validation.",
      inputSchema: {
        type: "object",
        properties: { toolName: { type: "string" }, arguments: { type: "object" } },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "scribe_safe",
      label: "Safe",
      description: "Live-discovered non-mutating document, workflow, and insight reads run directly; mutating or destructive tools fail closed.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Every selected OAuth-authorized capability published by Scribe's current read-only MCP runs without Relay per-action approval; ownership, provider permissions, live schemas, bounds, audits, redaction, and rate limits still apply.",
      defaultSelected: false,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [{ id: "oauth_and_mcp_tools", label: "Scribe OAuth and hosted MCP capability check", requiredScopes: [] }],
};
