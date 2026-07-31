import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { DRAW_IO_TOOLS } from "./draw-io-mcp.adapter";

const actions = [
  action(
    "draw_io_mcp_use",
    "Create diagrams and find shapes",
    "Create one interactive draw.io diagram or search the public shape library through the official hosted MCP.",
  ),
];

export const DRAW_IO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "draw-io",
  name: "Draw.io",
  connectorType: "mcp_backed",
  providerDocsUrl: "https://github.com/jgraph/drawio-mcp",
  providerWebsiteUrl: "https://www.drawio.com/",
  capabilities: [
    {
      ...capability(
        "diagram_creation",
        "Create interactive diagrams",
        "Create editable draw.io diagrams from Mermaid or native draw.io XML and return them as interactive MCP resources.",
        true,
      ),
      platformCapability: "draw_io_diagram_creation",
    },
    {
      ...capability(
        "shape_search",
        "Search the shape library",
        "Find exact styles and dimensions across draw.io's public cloud, network, engineering, infrastructure, and interface shape libraries.",
        true,
      ),
      platformCapability: "draw_io_shape_search",
    },
  ],
  auth: { type: "mcp", credentialSchema: [] },
  tools: [
    {
      name: "draw-io.use",
      functionName: "draw_io_use",
      aliases: ["draw-io.use", "draw_io_use", "draw_io_mcp_use"],
      capability: "diagram_creation",
      platformCapability: "draw_io_diagram_creation",
      action: "read",
      approvalRequired: false,
      description: "Invoke one exact official Draw.io hosted MCP tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...DRAW_IO_TOOLS] },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "draw_io_safe",
      label: "Safe",
      description: "Diagram generation and public shape search run directly because Draw.io stores no account data and the hosted MCP persists nothing.",
      defaultSelected: true,
      allowedActions: actions,
      approvalRequiredActions: [],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Both public Draw.io MCP tools run directly; exact tool allowlists, live schemas, bounds, audits, and credential rejection still apply.",
      defaultSelected: false,
      allowedActions: actions,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "hosted_mcp_tools", label: "Draw.io hosted MCP exact two-tool capability check" },
  ],
};
