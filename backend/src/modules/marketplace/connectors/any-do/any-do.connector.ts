import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ANY_DO_SCOPES = [
  "access_anydo_data",
  "update_anydo_data",
] as const;

const read = action(
  "any_do_mcp_read",
  "Read Any.do",
  "Use one live-discovered Any.do MCP read tool with bounded arguments.",
);
const manage = action(
  "any_do_mcp_manage",
  "Manage Any.do",
  "Use one live-discovered Any.do MCP tool; Safe mode requires approval.",
);

export const ANY_DO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "any-do",
  name: "Any.do",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://support.any.do/en/articles/15505097-any-do-mcp",
  providerWebsiteUrl: "https://www.any.do/",
  capabilities: [
    {
      ...capability(
        "productivity_read",
        "Read tasks, plans, and calendars",
        "Use Any.do's hosted MCP to read personal tasks and lists, reminders, workspace boards and sections, calendar events, and grocery lists authorized by the connected account.",
        true,
      ),
      platformCapability: "any_do_productivity_read",
    },
    {
      ...capability(
        "productivity_manage",
        "Manage tasks, plans, and calendars",
        "Create, update, complete, archive, or delete authorized tasks; manage reminders, workspace boards, calendar events, and grocery items through live-discovered provider tools.",
        true,
      ),
      platformCapability: "any_do_productivity_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://mcp.any.do/authorize",
      tokenUrl: "https://mcp.any.do/token",
      userInfoUrl: "https://mcp.any.do/sse",
      requiredScopes: [...ANY_DO_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ANY_DO_CLIENT_ID",
        label: "Any.do OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned dynamically registered client ID configured on Railway.",
      },
      {
        name: "ANY_DO_CLIENT_SECRET",
        label: "Any.do OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned dynamically registered client secret stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "any-do.read",
      functionName: "any_do_mcp_read",
      aliases: ["any-do.read", "any_do_mcp_read"],
      capability: "productivity_read",
      platformCapability: "any_do_productivity_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one live-discovered non-mutating Any.do MCP tool with bounded arguments.",
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
      name: "any-do.manage",
      functionName: "any_do_mcp_manage",
      aliases: ["any-do.manage", "any_do_mcp_manage"],
      capability: "productivity_manage",
      platformCapability: "any_do_productivity_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one live-discovered Any.do MCP tool with bounded arguments; Safe mode requires approval.",
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
      id: "any_do_safe",
      label: "Safe",
      description:
        "Live-discovered reads run directly; every task, reminder, board, calendar, grocery, sharing, or administrative mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected OAuth-authorized Any.do MCP operation runs without Relay per-action approval; ownership, provider authority, live schema discovery, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Any.do OAuth and hosted MCP capability check",
      requiredScopes: [...ANY_DO_SCOPES],
    },
  ],
};
