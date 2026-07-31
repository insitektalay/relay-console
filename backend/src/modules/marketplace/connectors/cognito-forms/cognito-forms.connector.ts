import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  COGNITO_FORMS_MCP_CLIENT_ID,
  COGNITO_FORMS_READ_TOOLS,
  COGNITO_FORMS_WRITE_TOOLS,
} from "./cognito-forms-mcp.adapter";

export const COGNITO_FORMS_SCOPES = [
  "form_create",
  "form_read",
  "form_update",
  "entry_create",
  "entry_read",
  "entry_update",
  "entry_delete",
  "file_read",
  "entryview_read",
] as const;

const reads = [
  action(
    "cognito_forms_mcp_read",
    "Read forms, entries, documents, and files",
    "Use one documented Cognito Forms entry, entry-list, generated-document, or uploaded-file read tool.",
  ),
];
const writes = [
  action(
    "cognito_forms_mcp_write",
    "Create or change forms and entries",
    "Generate forms, create, update, or delete entries, or change form availability; Safe mode requires approval.",
  ),
];

export const COGNITO_FORMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cognito-forms",
  name: "Cognito Forms",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.cognitoforms.com/support/1038/data-integration/mcp-connector",
  providerWebsiteUrl: "https://www.cognitoforms.com/",
  capabilities: [
    {
      ...capability(
        "forms_and_entries",
        "Read forms and entries",
        "Read individual entries, query form entries, and retrieve generated documents or uploaded files.",
        true,
      ),
      platformCapability: "cognito_forms_read",
    },
    {
      ...capability(
        "form_creation",
        "Create forms",
        "Generate new Cognito Forms forms through the connected organization.",
        true,
      ),
      platformCapability: "cognito_forms_create",
    },
    {
      ...capability(
        "entry_management",
        "Manage entries and availability",
        "Create, update, and delete entries and open or close forms to new submissions.",
        true,
      ),
      platformCapability: "cognito_forms_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.cognitoforms.com/api-connection",
      tokenUrl:
        "https://www.cognitoforms.com/svc/integration/oauth/access-token",
      userInfoUrl: "https://mcp.cognitoforms.com/mcp",
      requiredScopes: [...COGNITO_FORMS_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "COGNITO_FORMS_MCP_CLIENT_ID",
        label: "Cognito Forms public MCP client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: `Cognito Forms publishes ${COGNITO_FORMS_MCP_CLIENT_ID} for custom public PKCE MCP connections; Relay uses that fixed non-secret value.`,
      },
    ],
  },
  tools: [
    {
      name: "cognitoForms.read",
      functionName: "cognito_forms_read",
      aliases: [
        "cognitoForms.read",
        "cognito_forms_read",
        "cognito_forms_mcp_read",
      ],
      capability: "forms_and_entries",
      platformCapability: "cognito_forms_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one exact documented Cognito Forms MCP read tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...COGNITO_FORMS_READ_TOOLS] },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "cognitoForms.write",
      functionName: "cognito_forms_write",
      aliases: [
        "cognitoForms.write",
        "cognito_forms_write",
        "cognito_forms_mcp_write",
      ],
      capability: "entry_management",
      platformCapability: "cognito_forms_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one exact documented Cognito Forms form or entry mutation after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...COGNITO_FORMS_WRITE_TOOLS] },
          arguments: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "cognito_forms_safe",
      label: "Safe",
      description:
        "Entry, document, and file reads run directly; form and entry changes require approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected OAuth-authorized Cognito Forms MCP operation runs without Relay per-action approval; ownership, provider permissions, exact tool allowlists, live schemas, bounds, audits, and redaction still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Cognito Forms OAuth and exact 9-tool MCP capability check",
    },
  ],
};
