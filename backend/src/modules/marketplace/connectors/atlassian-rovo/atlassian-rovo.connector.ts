import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "atlassian_rovo_discover_tools",
    "Discover tools",
    "List bounded metadata for tools granted by Atlassian Rovo MCP.",
  ),
  action(
    "atlassian_rovo_call_read_tool",
    "Use a read tool",
    "Call a discovered Atlassian Rovo tool classified as read-only.",
  ),
];
const writes = [
  action(
    "atlassian_rovo_call_tool",
    "Use any granted tool",
    "Call any provider-granted Atlassian Rovo tool; Safe mode requires approval.",
  ),
];

export const ATLASSIAN_ROVO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "atlassian-rovo",
  name: "Atlassian Rovo",
  connectorType: "mcp_backed",
  providerDocsUrl: "https://developer.atlassian.com/cloud/rovo-mcp/",
  providerWebsiteUrl: "https://www.atlassian.com/software/rovo",
  capabilities: [
    {
      ...capability(
        "discovery",
        "Tool discovery",
        "Discover tools granted by the Atlassian organization and service account.",
        true,
      ),
      platformCapability: "atlassian_rovo_mcp_discovery",
    },
    {
      ...capability(
        "read_tools",
        "Read tools",
        "Call discovered read-only Atlassian Rovo tools.",
        true,
      ),
      platformCapability: "atlassian_rovo_mcp_read",
    },
    {
      ...capability(
        "full_mcp",
        "Full MCP",
        "Call any provider-granted Atlassian Rovo tool under the selected Relay policy.",
        false,
      ),
      platformCapability: "atlassian_rovo_mcp_full",
    },
  ],
  auth: {
    type: "mcp",
    credentialSchema: [
      {
        name: "ATLASSIAN_ROVO_SERVICE_ACCOUNT_API_KEY",
        label: "Atlassian service account API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["mcp"],
        helpText:
          "Use a scoped Atlassian service account API key after an organization admin enables API-token authentication for Rovo MCP.",
      },
    ],
  },
  tools: [
    {
      name: "atlassianRovo.listTools",
      functionName: "atlassian_rovo_list_tools",
      aliases: ["atlassianRovo.listTools", "atlassian_rovo_list_tools"],
      capability: "discovery",
      platformCapability: "atlassian_rovo_mcp_discovery",
      action: "read",
      approvalRequired: false,
      description:
        "List bounded metadata for tools granted by Atlassian Rovo MCP.",
      inputSchema: emptySchema(),
    },
    {
      name: "atlassianRovo.callReadTool",
      functionName: "atlassian_rovo_call_read_tool",
      aliases: ["atlassianRovo.callReadTool", "atlassian_rovo_call_read_tool"],
      capability: "read_tools",
      platformCapability: "atlassian_rovo_mcp_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call a discovered Atlassian Rovo tool classified as read-only.",
      inputSchema: callSchema(false),
    },
    {
      name: "atlassianRovo.callTool",
      functionName: "atlassian_rovo_call_tool",
      aliases: ["atlassianRovo.callTool", "atlassian_rovo_call_tool"],
      capability: "full_mcp",
      platformCapability: "atlassian_rovo_mcp_full",
      action: "admin",
      approvalRequired: true,
      description:
        "Call any provider-granted Atlassian Rovo tool. Safe mode requires approval.",
      inputSchema: callSchema(true),
    },
  ],
  approvalProfiles: [
    {
      id: "atlassian_rovo_safe",
      label: "Safe",
      description:
        "Discovery and read-only tools run directly; every other provider-granted tool requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected provider-granted tool runs without Relay per-action approval; Atlassian permissions, secret isolation, bounds, and audits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "mcp_initialize_tools",
      label: "Atlassian Rovo MCP initialize and tool-discovery check",
    },
  ],
};

function emptySchema() {
  return { type: "object", properties: {}, additionalProperties: false };
}

function callSchema(withApproval: boolean) {
  return {
    type: "object",
    properties: {
      toolName: { type: "string", minLength: 1, maxLength: 200 },
      arguments: { type: "object" },
      ...(withApproval ? { approvalId: { type: "string" } } : {}),
    },
    required: ["toolName"],
    additionalProperties: false,
  };
}
