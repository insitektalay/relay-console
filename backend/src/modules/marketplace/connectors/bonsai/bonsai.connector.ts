import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { BONSAI_READ_TOOLS, BONSAI_WRITE_TOOLS } from "./bonsai-mcp.adapter";

const reads = [
  action(
    "bonsai_mcp_read",
    "Read Bonsai",
    "Use one documented Bonsai MCP task, project, team, deal, pipeline, contact, company, tag, or invoice read tool.",
  ),
];
const writes = [
  action(
    "bonsai_mcp_write",
    "Manage Bonsai",
    "Create, update, or delete authorized tasks, projects, deals, contacts, companies, time entries, invoices, and invoice items; Safe mode requires approval.",
  ),
];
const guards = [
  action(
    "bonsai_secret_exposure",
    "Expose OAuth material",
    "OAuth codes, tokens, verifiers, authorization headers, cookies, and credentials never enter tool arguments or agent-visible results.",
  ),
  action(
    "bonsai_raw_mcp",
    "Use raw MCP",
    "Relay exposes only the 25 documented Bonsai tools after live schema discovery, never arbitrary MCP methods or provider-added tools.",
  ),
  action(
    "bonsai_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds arguments, responses, tool discovery, cursors, nesting, redirects, and execution time.",
  ),
];

export const BONSAI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bonsai",
  name: "Bonsai",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.hellobonsai.com/",
  providerWebsiteUrl: "https://www.hellobonsai.com/",
  capabilities: [
    {
      ...capability(
        "bonsai_read",
        "Read work and CRM data",
        "Read authorized tasks, subtasks, projects, team members, deals, pipeline stages, contacts, companies, tags, and invoices through all 12 documented read tools.",
        true,
      ),
      platformCapability: "bonsai_read",
    },
    {
      ...capability(
        "bonsai_manage",
        "Manage work, CRM, time, and invoices",
        "Use all 13 documented mutations for tasks, projects, deals, contacts, companies, time entries, invoices, and invoice items.",
        true,
      ),
      platformCapability: "bonsai_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.hellobonsai.com/oauth/authorize",
      tokenUrl: "https://app.hellobonsai.com/oauth/token",
      revocationUrl: "https://app.hellobonsai.com/oauth/revoke",
      userInfoUrl: "https://mcp.hellobonsai.com/mcp",
      requiredScopes: [],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "BONSAI_MCP_CLIENT_ID",
        label: "Bonsai MCP OAuth client ID",
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
      name: "bonsai.read",
      functionName: "bonsai_read",
      aliases: ["bonsai.read", "bonsai_read", "bonsai_mcp_read"],
      capability: "bonsai_read",
      platformCapability: "bonsai_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one exact documented Bonsai MCP read tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...BONSAI_READ_TOOLS] },
          arguments: { type: "object", maxProperties: 100 },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "bonsai.write",
      functionName: "bonsai_write",
      aliases: ["bonsai.write", "bonsai_write", "bonsai_mcp_write"],
      capability: "bonsai_manage",
      platformCapability: "bonsai_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one exact documented Bonsai MCP mutation after live schema discovery; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...BONSAI_WRITE_TOOLS] },
          arguments: { type: "object", maxProperties: 100 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "bonsai_safe",
      label: "Safe",
      description:
        "All 12 documented reads run directly; every create, update, delete, time-entry, or invoice mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All 25 selected and OAuth-authorized Bonsai MCP tools run without Relay per-action approval; connection ownership, role permissions, exact tool allowlists, live schemas, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Bonsai OAuth, permissions, and documented MCP tool check",
    },
  ],
};
