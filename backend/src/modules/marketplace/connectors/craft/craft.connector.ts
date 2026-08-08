import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  CRAFT_MANAGE_OPERATIONS,
  CRAFT_READ_OPERATIONS,
} from "./craft-api.adapter";

const reads = [
  action(
    "craft_api_read",
    "Read Craft content",
    "Use one live-schema-verified read tool from Craft's official hosted MCP server.",
  ),
];
const manages = [
  action(
    "craft_api_manage",
    "Manage Craft content",
    "Use one live-schema-verified mutation from Craft's official hosted MCP server; Safe mode requires approval.",
  ),
];
const blockedActions = [
  blocked(
    "craft_raw_api",
    "Mount raw Craft MCP",
    "Relay separates provider-declared read-only tools from mutations and does not expose an ungoverned MCP surface.",
  ),
  blocked(
    "craft_secret_exposure",
    "Expose Craft credentials",
    "OAuth tokens and legacy API connection URLs remain encrypted and never enter tool inputs, results, logs, or audits.",
  ),
  blocked(
    "craft_unbounded_transfer",
    "Transfer unbounded content",
    "Requests, responses, arrays, nesting, and query fields remain inside Relay bounds.",
  ),
];

const commonProperties = {
  pathParams: {
    type: "object",
    properties: {
      collectionId: { type: "string", minLength: 1, maxLength: 200 },
    },
    additionalProperties: false,
  },
  query: { type: "object", additionalProperties: true },
};

export const CRAFT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "craft",
  name: "Craft",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://support.craft.do/en/integrate/mcp",
  providerWebsiteUrl: "https://www.craft.do/",
  capabilities: [
    {
      ...capability(
        "knowledge_read",
        "Read workspace knowledge",
        "Use provider-declared read-only MCP tools for the Craft space selected during authorization.",
        true,
      ),
      platformCapability: "craft_knowledge_read",
    },
    {
      ...capability(
        "knowledge_manage",
        "Manage workspace knowledge",
        "Use provider-declared MCP mutations in the Craft space selected during authorization.",
        true,
      ),
      platformCapability: "craft_knowledge_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://mcp.craft.do/my/auth/authorize",
      tokenUrl: "https://mcp.craft.do/my/auth/token",
      userInfoUrl: "https://mcp.craft.do/my/mcp",
      requiredScopes: [],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "CRAFT_API_URL",
        label: "Craft API connection URL",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["customer_scoped_api_url", "api_key"],
        helpText:
          "Compatibility only: existing Craft API connection URLs remain supported. New connections use Craft's official hosted MCP OAuth flow.",
      },
    ],
  },
  tools: [
    {
      name: "craft.discoverTools",
      functionName: "craft_mcp_discover_tools",
      aliases: ["craft.discoverTools", "craft_mcp_discover_tools"],
      capability: "knowledge_read",
      platformCapability: "craft_knowledge_read",
      action: "read",
      approvalRequired: false,
      description:
        "List the current bounded Craft MCP tool names, input schemas, and read-only classification for the selected space.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "craft.read",
      functionName: "craft_api_read",
      aliases: ["craft.read", "craft_api_read"],
      capability: "knowledge_read",
      platformCapability: "craft_knowledge_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one provider-declared read-only Craft MCP tool with its live object schema. Existing API URL connections keep the stable REST operation shape.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...CRAFT_READ_OPERATIONS] },
          toolName: { type: "string", minLength: 1, maxLength: 200 },
          arguments: { type: "object" },
          ...commonProperties,
        },
        anyOf: [
          { required: ["toolName", "arguments"] },
          { required: ["operation"] },
        ],
        additionalProperties: false,
      },
    },
    {
      name: "craft.manage",
      functionName: "craft_api_manage",
      aliases: ["craft.manage", "craft_api_manage"],
      capability: "knowledge_manage",
      platformCapability: "craft_knowledge_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one provider-declared Craft MCP mutation with its live object schema. Existing API URL connections keep the stable REST operation shape.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...CRAFT_MANAGE_OPERATIONS] },
          toolName: { type: "string", minLength: 1, maxLength: 200 },
          arguments: { type: "object" },
          ...commonProperties,
          body: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        anyOf: [
          { required: ["toolName", "arguments"] },
          { required: ["operation", "body"] },
        ],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "craft_safe",
      label: "Safe",
      description:
        "Provider-declared read-only MCP tools run directly; every Craft mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: manages,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected connection-authorized Craft operation runs without Relay per-action approval; exact authority, provider permissions, operation allowlists, bounds, redaction, audits, and fair-use limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...manages],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Craft OAuth and hosted MCP live-tool validation",
    },
  ],
};
