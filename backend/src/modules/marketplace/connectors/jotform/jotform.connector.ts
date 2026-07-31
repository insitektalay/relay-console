import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  JOTFORM_MANAGE_OPERATION_IDS,
  JOTFORM_OPERATIONS,
  JOTFORM_READ_OPERATION_IDS,
} from "./jotform-operation-registry";
import {
  JOTFORM_MCP_READ_TOOLS,
  JOTFORM_MCP_WRITE_TOOLS,
} from "./jotform-mcp.adapter";

export const JOTFORM_SCOPES = ["readOnly"] as const;
export const JOTFORM_ACCESS_OPTIONS = [
  {
    id: "read_only",
    label: "Read only",
    description:
      "Allow Relay to list forms and read submissions without creating or editing provider data.",
    scopes: ["readOnly"],
    capabilityIds: ["jotform_read"],
    defaultSelected: true,
  },
  {
    id: "read_write",
    label: "Read and write",
    description:
      "Allow Relay to read submissions and create or edit forms under Relay approval policy.",
    scopes: ["full"],
    capabilityIds: ["jotform_read", "jotform_manage"],
    defaultSelected: false,
  },
] as const;

const read = action(
  "jotform_read",
  "Read Jotform",
  "Read forms and submissions through Jotform's official hosted MCP server.",
);
const manage = action(
  "jotform_manage",
  "Manage Jotform",
  "Create or edit forms through Jotform's official hosted MCP server. Safe mode requires approval.",
);
const guards = [
  action(
    "jotform_raw_mcp",
    "Mount raw MCP",
    "Relay exposes exact read and write wrappers rather than an ungoverned provider tool surface.",
  ),
  action(
    "jotform_untrusted_origin",
    "Use another MCP origin",
    "OAuth tokens are attached only to Jotform's published hosted MCP resource.",
  ),
  action(
    "jotform_secret_exposure",
    "Expose credentials",
    "OAuth tokens and legacy API keys stay encrypted and never enter agent-visible arguments or results.",
  ),
  action(
    "jotform_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds live schemas, arguments, results, nesting, pagination, redirects, and execution time.",
  ),
];

export const JOTFORM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "jotform",
  name: "Jotform",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.jotform.com/docs/",
  providerWebsiteUrl: "https://www.jotform.com/",
  capabilities: [
    {
      ...capability(
        "jotform_read",
        "Read forms and results",
        "List authorized forms and read form submissions through Jotform's official hosted MCP server.",
        true,
      ),
      platformCapability: "jotform_read",
    },
    {
      ...capability(
        "jotform_manage",
        "Manage forms and workflows",
        "Create forms from an exact field definition and edit forms through Jotform's official hosted MCP server.",
        false,
      ),
      platformCapability: "jotform_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://oauth2.jotform.com/authorize",
      tokenUrl: "https://oauth2.jotform.com/token",
      userInfoUrl: "https://mcp.jotform.com/mcp",
      requiredScopes: [...JOTFORM_SCOPES],
      optionalScopes: [],
      accessOptions: JOTFORM_ACCESS_OPTIONS.map((option) => ({
        ...option,
        scopes: [...option.scopes],
        capabilityIds: [...option.capabilityIds],
      })),
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "JOTFORM_API_KEY",
        label: "Jotform API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["customer_owned_api_key", "api_key"],
        helpText:
          "Compatibility only: an existing dedicated Jotform API key remains supported without being the default connection path.",
      },
      {
        name: "JOTFORM_API_REGION",
        label: "Jotform API region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["customer_owned_api_key", "api_key"],
        helpText:
          "Compatibility only: choose Standard, EU, or HIPAA to match an existing API-key connection.",
      },
    ],
  },
  tools: [
    {
      name: "jotform.read",
      functionName: "jotform_read",
      aliases: ["jotform.read", "jotform_read"],
      capability: "jotform_read",
      platformCapability: "jotform_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one exact documented Jotform MCP read tool; existing API-key connections may continue using the pinned REST operation shape.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...JOTFORM_MCP_READ_TOOLS] },
          arguments: { type: "object" },
          operation: { type: "string", enum: [...JOTFORM_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 24 },
        },
        anyOf: [
          { required: ["toolName", "arguments"] },
          { required: ["operation"] },
        ],
        additionalProperties: false,
      },
    },
    {
      name: "jotform.manage",
      functionName: "jotform_manage",
      aliases: ["jotform.manage", "jotform_manage"],
      capability: "jotform_manage",
      platformCapability: "jotform_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one exact documented Jotform MCP mutation; existing API-key connections may continue using the pinned REST operation shape. Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...JOTFORM_MCP_WRITE_TOOLS] },
          arguments: { type: "object" },
          operation: {
            type: "string",
            enum: [...JOTFORM_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 24 },
          form: { type: "object", maxProperties: 1000 },
          json: {},
          approvalId: { type: "string", maxLength: 200 },
        },
        anyOf: [
          { required: ["toolName", "arguments"] },
          { required: ["operation"] },
        ],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "jotform_safe",
      label: "Safe",
      description:
        "Official MCP form and submission reads run directly; every form or submission mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All selected OAuth-authorized MCP operations, or ${JOTFORM_OPERATIONS.length} operations on a legacy API-key connection, run without Relay per-action approval. Connection ownership, provider authority, fixed origins, bounds, audits, redaction, and provider limits remain enforced.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Jotform OAuth and exact five-tool hosted MCP capability check",
      requiredScopes: [...JOTFORM_SCOPES],
    },
  ],
};
