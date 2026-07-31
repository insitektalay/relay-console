import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const SUNSAMA_SCOPES = ["read", "execute", "offline_access"] as const;

const read = action(
  "sunsama_mcp_read",
  "Read Sunsama",
  "Use one live-schema-verified Sunsama read tool or the bounded daily-task resource.",
);
const manage = action(
  "sunsama_mcp_manage",
  "Manage Sunsama",
  "Use one live-schema-verified Sunsama task, planning, scheduling, notes, focus, or timer mutation; Safe mode requires approval.",
);
const guards = [
  action(
    "sunsama_raw_mcp",
    "Mount raw MCP",
    "Relay exposes typed read and manage wrappers rather than an ungoverned provider tool surface.",
  ),
  action(
    "sunsama_untrusted_origin",
    "Use another MCP origin",
    "OAuth tokens are attached only to Sunsama's published hosted MCP resource.",
  ),
  action(
    "sunsama_secret_exposure",
    "Expose OAuth credentials",
    "OAuth tokens stay encrypted and never enter agent-visible arguments or results.",
  ),
  action(
    "sunsama_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds live schemas, arguments, result sizes, nesting, pagination, redirects, and execution time.",
  ),
];

export const SUNSAMA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sunsama",
  name: "Sunsama",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.sunsama.com/docs/integrations/mcp/",
  providerWebsiteUrl: "https://sunsama.com/",
  capabilities: [
    {
      ...capability(
        "productivity_read",
        "Read daily tasks, backlog, and task details",
        "Read the authorized task list for a chosen day, ordered backlog tasks, individual task details, notes, estimates, priority, channel and integration-source context exposed by Sunsama.",
        true,
      ),
      platformCapability: "sunsama_productivity_read",
    },
    {
      ...capability(
        "productivity_manage",
        "Manage tasks, notes, planning, focus, and timers",
        "Use Sunsama's current live MCP tools to create and edit tasks, assign channels, append or replace notes, change estimates and dates, complete work, timebox tasks, and control supported focus or timer actions.",
        true,
      ),
      platformCapability: "sunsama_productivity_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.sunsama.com/oauth/authorize",
      tokenUrl: "https://api.sunsama.com/oauth/token",
      userInfoUrl: "https://api.sunsama.com/mcp",
      requiredScopes: [...SUNSAMA_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SUNSAMA_CLIENT_ID",
        label: "Sunsama OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned public S256 PKCE client dynamically registered with Sunsama and configured on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "sunsama.read",
      functionName: "sunsama_mcp_read",
      aliases: ["sunsama.read", "sunsama_mcp_read"],
      capability: "productivity_read",
      platformCapability: "sunsama_productivity_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one provider-declared read-only Sunsama MCP tool with its live object schema and bounded arguments.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", minLength: 1, maxLength: 200 },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "sunsama.tasksForDay",
      functionName: "sunsama_mcp_read_tasks_for_day",
      aliases: ["sunsama.tasksForDay", "sunsama_mcp_read_tasks_for_day"],
      capability: "productivity_read",
      platformCapability: "sunsama_productivity_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read the official Sunsama daily-task resource for one ISO calendar date.",
      inputSchema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
          },
        },
        required: ["date"],
        additionalProperties: false,
      },
    },
    {
      name: "sunsama.manage",
      functionName: "sunsama_mcp_manage",
      aliases: ["sunsama.manage", "sunsama_mcp_manage"],
      capability: "productivity_manage",
      platformCapability: "sunsama_productivity_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one provider-declared Sunsama MCP mutation with its live object schema and bounded arguments; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", minLength: 1, maxLength: 200 },
          arguments: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "sunsama_safe",
      label: "Safe",
      description:
        "Daily-task resources and provider-declared read-only tools run directly. Every task, planning, notes, focus, timer, or other provider mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected OAuth-authorized Sunsama operation runs without Relay per-action approval; ownership, provider authority, live schema verification, fixed origin, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Sunsama OAuth and hosted MCP capability check",
      requiredScopes: [...SUNSAMA_SCOPES],
    },
  ],
};
