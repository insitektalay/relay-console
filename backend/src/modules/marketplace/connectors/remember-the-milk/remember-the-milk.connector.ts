import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  REMEMBER_THE_MILK_MANAGE_TOOLS,
  REMEMBER_THE_MILK_READ_TOOLS,
} from "./remember-the-milk-mcp.adapter";

export const REMEMBER_THE_MILK_SCOPES = ["read", "write", "delete"] as const;

const read = action(
  "remember_the_milk_mcp_read",
  "Read Remember The Milk",
  "Use one documented Remember The Milk task, list, note, location, reminder, contact, script, or setting read tool.",
);
const manage = action(
  "remember_the_milk_mcp_manage",
  "Manage Remember The Milk",
  "Use one documented Remember The Milk mutation, batch, sharing, automation, settings, or undo tool; Safe mode requires approval.",
);

export const REMEMBER_THE_MILK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "remember-the-milk",
    name: "Remember The Milk",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://www.rememberthemilk.com/services/mcp/",
    providerWebsiteUrl: "https://www.rememberthemilk.com/",
    capabilities: [
      {
        ...capability(
          "productivity_read",
          "Read tasks and organization",
          "Read authorized tasks, lists, permissions, tags, notes, locations, reminders, contacts, scripts, settings, timezone, and language.",
          true,
        ),
        platformCapability: "remember_the_milk_productivity_read",
      },
      {
        ...capability(
          "productivity_manage",
          "Manage tasks and organization",
          "Create, update, complete, batch, share, automate, delete, restore, configure, and undo authorized Remember The Milk work.",
          true,
        ),
        platformCapability: "remember_the_milk_productivity_manage",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://www.rememberthemilk.com/oauth/authorize.rtm",
        tokenUrl: "https://www.rememberthemilk.com/oauth/token.rtm",
        revocationUrl: "https://www.rememberthemilk.com/oauth/revoke.rtm",
        userInfoUrl: "https://www.rememberthemilk.com/mcp",
        requiredScopes: [...REMEMBER_THE_MILK_SCOPES],
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "REMEMBER_THE_MILK_CLIENT_ID",
          label: "Remember The Milk OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Relay-owned dynamically registered client ID configured on Railway.",
        },
        {
          name: "REMEMBER_THE_MILK_CLIENT_SECRET",
          label: "Remember The Milk OAuth client secret",
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
        name: "remember-the-milk.read",
        functionName: "remember_the_milk_mcp_read",
        aliases: ["remember-the-milk.read", "remember_the_milk_mcp_read"],
        capability: "productivity_read",
        platformCapability: "remember_the_milk_productivity_read",
        action: "read",
        approvalRequired: false,
        description:
          "Invoke one exact documented Remember The Milk read tool after live schema verification.",
        inputSchema: {
          type: "object",
          properties: {
            toolName: {
              type: "string",
              enum: [...REMEMBER_THE_MILK_READ_TOOLS],
            },
            arguments: { type: "object" },
          },
          required: ["toolName", "arguments"],
          additionalProperties: false,
        },
      },
      {
        name: "remember-the-milk.manage",
        functionName: "remember_the_milk_mcp_manage",
        aliases: ["remember-the-milk.manage", "remember_the_milk_mcp_manage"],
        capability: "productivity_manage",
        platformCapability: "remember_the_milk_productivity_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Invoke one exact documented Remember The Milk management tool after live schema verification; Safe mode requires approval.",
        inputSchema: {
          type: "object",
          properties: {
            toolName: {
              type: "string",
              enum: [...REMEMBER_THE_MILK_MANAGE_TOOLS],
            },
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
        id: "remember_the_milk_safe",
        label: "Safe",
        description:
          "Task and organization reads run directly; every create, update, batch, sharing, automation, settings, delete, restore, or undo operation requires approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: [],
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Every selected OAuth-authorized Remember The Milk MCP operation runs without Relay per-action approval; ownership, provider authority, exact tool allowlists, live schemas, bounds, audits, redaction, and provider limits still apply.",
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: [],
      },
    ],
    healthChecks: [
      {
        id: "oauth_and_mcp_tools",
        label:
          "Remember The Milk OAuth and exact 58-tool hosted MCP capability check",
        requiredScopes: [...REMEMBER_THE_MILK_SCOPES],
      },
    ],
  };
