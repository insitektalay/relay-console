import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("fusebase_discover_tools", "Discover tools", "List the bounded tools granted by the customer's FuseBase MCP configuration."),
  action("fusebase_call_read_tool", "Use a read tool", "Call a discovered FuseBase tool whose name is classified as read-only."),
];
const writes = [
  action("fusebase_call_tool", "Use any granted tool", "Call any tool granted by the customer's FuseBase MCP configuration; approval is required in Safe mode."),
];

export const FUSEBASE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "nimbus-note",
  name: "FuseBase (formerly Nimbus Note)",
  connectorType: "mcp_backed",
  providerDocsUrl: "https://thefusebase.com/guides/fusebase-ai/connect-external-ai-agents-to-fusebase-with-mcp/",
  providerWebsiteUrl: "https://thefusebase.com/",
  capabilities: [
    { ...capability("discovery", "Tool discovery", "Discover the tools granted by the customer-owned MCP configuration.", true), platformCapability: "fusebase_mcp_discovery" },
    { ...capability("read_tools", "Read tools", "Call discovered read-only FuseBase tools.", true), platformCapability: "fusebase_mcp_read" },
    { ...capability("full_mcp", "Full MCP", "Call every provider-granted FuseBase MCP tool under the selected Relay policy.", false), platformCapability: "fusebase_mcp_full" },
  ],
  auth: {
    type: "mcp",
    credentialSchema: [
      { name: "FUSEBASE_MCP_URL", label: "FuseBase MCP URL", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["mcp"], helpText: "Copy the remote MCP URL from your FuseBase organization MCP configuration. Relay accepts only official FuseBase HTTPS hosts." },
      { name: "FUSEBASE_MCP_TOKEN", label: "FuseBase MCP token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["mcp"], helpText: "Copy the revocable token shown when you create the FuseBase MCP configuration." },
    ],
  },
  tools: [
    { name: "fusebase.listTools", functionName: "fusebase_list_tools", aliases: ["fusebase.listTools", "fusebase_list_tools"], capability: "discovery", platformCapability: "fusebase_mcp_discovery", action: "read", approvalRequired: false, description: "List bounded metadata for tools granted by FuseBase.", inputSchema: emptySchema() },
    { name: "fusebase.callReadTool", functionName: "fusebase_call_read_tool", aliases: ["fusebase.callReadTool", "fusebase_call_read_tool"], capability: "read_tools", platformCapability: "fusebase_mcp_read", action: "read", approvalRequired: false, description: "Call a discovered tool whose name is classified as read-only.", inputSchema: callSchema(false) },
    { name: "fusebase.callTool", functionName: "fusebase_call_tool", aliases: ["fusebase.callTool", "fusebase_call_tool"], capability: "full_mcp", platformCapability: "fusebase_mcp_full", action: "admin", approvalRequired: true, description: "Call any discovered provider-granted FuseBase MCP tool. Safe mode requires approval; Dangerous mode skips the Relay approval.", inputSchema: callSchema(true) },
  ],
  approvalProfiles: [
    { id: "fusebase_safe", label: "Safe", description: "Discovery and read-only tools run directly; every other provider-granted tool requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected provider-granted tool runs without Relay per-action approval; ownership, provider authority, secret isolation, output bounds, and audits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "mcp_initialize_tools", label: "FuseBase MCP initialize and tool-discovery check" }],
};

function emptySchema() { return { type: "object", properties: {}, additionalProperties: false }; }
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
