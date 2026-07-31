import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  TRACKINGTIME_MANAGE_TOOLS,
  TRACKINGTIME_READ_TOOLS,
} from "./trackingtime-mcp.adapter";

const read = action(
  "trackingtime_mcp_read",
  "Read TrackingTime",
  "Read the connected user's identity, workspaces, time entries, users, projects, tasks, customers, and assignments through TrackingTime's hosted MCP.",
);
const manage = action(
  "trackingtime_mcp_manage",
  "Manage TrackingTime",
  "Create or update projects, tasks, customers, events, and custom fields, or start and stop tracking; Safe mode requires approval.",
);

export const TRACKINGTIME_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "trackingtime",
  name: "TrackingTime",
  connectorType: "mcp_backed",
  providerDocsUrl:
    "https://support.trackingtime.co/en/articles/13738626-trackingtime-mcp-server-for-ai-assistants",
  providerWebsiteUrl: "https://trackingtime.co/",
  capabilities: [
    {
      ...capability(
        "trackingtime_read",
        "Read time and work data",
        `Use all ${TRACKINGTIME_READ_TOOLS.length} documented hosted-MCP reads for identity, workspaces, time entries, people, projects, tasks, customers, and assignments.`,
        true,
      ),
      platformCapability: "trackingtime_read",
    },
    {
      ...capability(
        "trackingtime_manage",
        "Manage time and work data",
        `Use all ${TRACKINGTIME_MANAGE_TOOLS.length} documented hosted-MCP actions for projects, tasks, customers, events, timers, and custom fields.`,
        true,
      ),
      platformCapability: "trackingtime_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TRACKINGTIME_APP_PASSWORD",
        label: "TrackingTime App Password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create an App Password in TrackingTime under Settings, Apps & Integrations, then paste it here. Relay encrypts it and sends it only to TrackingTime's hosted MCP server.",
      },
    ],
  },
  tools: [
    {
      name: "trackingTime.read",
      functionName: "trackingtime_read",
      aliases: ["trackingTime.read", "trackingtime_read"],
      capability: "trackingtime_read",
      platformCapability: "trackingtime_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one exact documented TrackingTime hosted-MCP read tool with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...TRACKINGTIME_READ_TOOLS] },
          arguments: { type: "object", maxProperties: 100 },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "trackingTime.manage",
      functionName: "trackingtime_manage",
      aliases: ["trackingTime.manage", "trackingtime_manage"],
      capability: "trackingtime_manage",
      platformCapability: "trackingtime_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one exact documented TrackingTime hosted-MCP mutation with bounded arguments and results; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...TRACKINGTIME_MANAGE_TOOLS] },
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
      id: "trackingtime_safe",
      label: "Safe",
      description: `All ${TRACKINGTIME_READ_TOOLS.length} reads run directly; every create, update, timer, and custom-field action requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${TRACKINGTIME_READ_TOOLS.length + TRACKINGTIME_MANAGE_TOOLS.length} selected and App-Password-authorized MCP tools run without Relay per-action approval; connection ownership, TrackingTime permissions, exact tool allowlists, live schemas, bounds, audits, redaction, and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "app_password_and_mcp_tools",
      label:
        "TrackingTime App Password, identity, and hosted-MCP capability check",
    },
  ],
};
