import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const AKIFLOW_SCOPES = ["mcp:read", "mcp:write"] as const;

const read = action(
  "akiflow_mcp_read",
  "Read Akiflow",
  "Use one verified Akiflow MCP read tool with bounded arguments.",
);
const manage = action(
  "akiflow_mcp_manage",
  "Manage Akiflow",
  "Use one verified Akiflow MCP task, planning, time-slot, or calendar mutation; Safe mode requires approval.",
);
const guards = [
  action(
    "akiflow_raw_mcp",
    "Mount raw MCP",
    "Relay exposes typed read and manage wrappers rather than an ungoverned provider tool surface.",
  ),
  action(
    "akiflow_untrusted_origin",
    "Use another MCP origin",
    "OAuth tokens are attached only to Akiflow's published hosted MCP resource.",
  ),
  action(
    "akiflow_secret_exposure",
    "Expose OAuth credentials",
    "OAuth tokens stay encrypted and never enter agent-visible arguments or results.",
  ),
  action(
    "akiflow_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds live schemas, arguments, result sizes, nesting, pagination, redirects, and execution time.",
  ),
];

export const AKIFLOW_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "akiflow",
  name: "Akiflow",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://product.akiflow.com/en/help/articles/4302815-akiflow-mcp",
  providerWebsiteUrl: "https://akiflow.com/",
  capabilities: [
    {
      ...capability(
        "productivity_read",
        "Read tasks, schedules, calendars, and meetings",
        "Read authorized tasks, inbox and someday work, projects, tags, priorities, schedules, time slots, connected calendars, events, meeting briefs, recordings, summaries, action items, and transcripts.",
        true,
      ),
      platformCapability: "akiflow_productivity_read",
    },
    {
      ...capability(
        "productivity_manage",
        "Manage tasks, plans, time slots, and events",
        "Create and update tasks, plan or unschedule work, mark tasks complete, create and edit time slots, and create, edit, or cancel authorized connected-calendar events.",
        true,
      ),
      platformCapability: "akiflow_productivity_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://web.akiflow.com/oauth/authorize",
      tokenUrl: "https://web.akiflow.com/oauth/token",
      userInfoUrl: "https://mcp.akiflow.com/mcp",
      requiredScopes: [...AKIFLOW_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "AKIFLOW_CLIENT_ID",
        label: "Akiflow OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned public S256 PKCE client dynamically registered with Akiflow and configured on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "akiflow.read",
      functionName: "akiflow_mcp_read",
      aliases: ["akiflow.read", "akiflow_mcp_read"],
      capability: "productivity_read",
      platformCapability: "akiflow_productivity_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one live-verified Akiflow MCP read tool with bounded arguments.",
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
      name: "akiflow.manage",
      functionName: "akiflow_mcp_manage",
      aliases: ["akiflow.manage", "akiflow_mcp_manage"],
      capability: "productivity_manage",
      platformCapability: "akiflow_productivity_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one live-verified Akiflow MCP mutation with bounded arguments; Safe mode requires approval.",
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
      id: "akiflow_safe",
      label: "Safe",
      description:
        "Verified reads run directly. Every task, planning, time-slot, calendar, guest-notification, or other provider mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected OAuth-authorized Akiflow operation runs without Relay per-action approval; ownership, provider authority, live schema verification, fixed origin, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Akiflow OAuth and hosted MCP capability check",
      requiredScopes: [...AKIFLOW_SCOPES],
    },
  ],
};
