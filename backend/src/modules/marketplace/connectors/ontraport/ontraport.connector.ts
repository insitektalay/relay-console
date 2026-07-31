import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ONTRAPORT_MANAGE_TOOLS,
  ONTRAPORT_READ_TOOLS,
} from "./ontraport-mcp.adapter";

const read = action(
  "ontraport_mcp_read",
  "Read Ontraport",
  "Use one documented Ontraport query, CRM, activity, task, campaign, invoice, purchase, payment, or account read.",
);
const manage = action(
  "ontraport_mcp_manage",
  "Manage Ontraport",
  "Use one documented CRM, automation, task, deletion, invoicing, payment, refund, subscription, or commerce action; Safe mode requires approval.",
);
const guards = [
  action(
    "ontraport_raw_mcp",
    "Mount raw MCP",
    "Relay exposes typed read and manage wrappers instead of an ungoverned provider surface.",
  ),
  action(
    "ontraport_other_origin",
    "Use another MCP origin",
    "Credentials are attached only to Ontraport's fixed hosted MCP endpoint.",
  ),
  action(
    "ontraport_secret_exposure",
    "Expose credentials",
    "The App ID and API key stay encrypted and never enter agent-visible arguments or results.",
  ),
  action(
    "ontraport_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds tool names, arguments, result sizes, nesting, pagination, redirects, and execution time.",
  ),
];

export const ONTRAPORT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ontraport",
  name: "Ontraport",
  connectorType: "mcp_backed",
  providerDocsUrl: "https://ontraport.com/support/My-account/mcp-server",
  providerWebsiteUrl: "https://ontraport.com/",
  capabilities: [
    {
      ...capability(
        "ontraport_read",
        "Read CRM, automation, tasks, engagement, and commerce",
        `Use all ${ONTRAPORT_READ_TOOLS.length} documented hosted-MCP reads for objects, fields, counts, account context, groups, subscribers, activity, messages, notes, tasks, broadcasts, pages, invoices, purchases, payments, and offer validation.`,
        true,
      ),
      platformCapability: "ontraport_read",
    },
    {
      ...capability(
        "ontraport_manage",
        "Manage CRM, automation, tasks, and commerce",
        `Use all ${ONTRAPORT_MANAGE_TOOLS.length} documented hosted-MCP actions for records, relationships, tags, subscriptions, tasks, automations, invoices, charges, refunds, write-offs, and recurring orders.`,
        true,
      ),
      platformCapability: "ontraport_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ONTRAPORT_APP_ID",
        label: "Ontraport App ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated integration in Ontraport's API Key Manager and paste its App ID. Relay stores it encrypted.",
      },
      {
        name: "ONTRAPORT_API_KEY",
        label: "Ontraport API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste the matching dedicated API key. Relay sends both credentials only to Ontraport's fixed hosted MCP endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "ontraport.read",
      functionName: "ontraport_read",
      aliases: ["ontraport.read", "ontraport_read", "ontraport_mcp_read"],
      capability: "ontraport_read",
      platformCapability: "ontraport_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one exact documented Ontraport hosted-MCP read tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...ONTRAPORT_READ_TOOLS] },
          arguments: { type: "object", maxProperties: 100 },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "ontraport.manage",
      functionName: "ontraport_manage",
      aliases: ["ontraport.manage", "ontraport_manage", "ontraport_mcp_manage"],
      capability: "ontraport_manage",
      platformCapability: "ontraport_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one exact documented Ontraport hosted-MCP mutation after live schema discovery; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...ONTRAPORT_MANAGE_TOOLS] },
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
      id: "ontraport_safe",
      label: "Safe",
      description:
        "Documented reads run directly; every CRM, automation, task, deletion, messaging, invoice, payment, refund, subscription, and commerce mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected key-authorized Ontraport MCP action runs without Relay per-action approval; ownership, provider permissions, fixed origin, exact allowlists, live schemas, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "app_id_api_key_and_mcp_tools",
      label:
        "Ontraport App ID, API key, identity, and hosted-MCP capability check",
    },
  ],
};
