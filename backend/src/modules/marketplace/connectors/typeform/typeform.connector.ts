import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "typeform_form_list_recent",
    "List workspace forms",
    "List at most twenty-five Typeform Form summaries from the selected workspace, newest update first.",
  ),
  action(
    "typeform_form_get",
    "Read a form summary",
    "Read one exact Typeform Form summary without questions, fields, choices, logic, media, variables or tracking.",
  ),
  action(
    "typeform_response_list_recent",
    "List recent response lifecycle",
    "List at most twenty-five completed Response lifecycle summaries submitted during the previous fourteen days.",
  ),
];

export const TYPEFORM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "typeform",
  name: "Typeform",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.typeform.com/developers/get-started/applications/",
  providerWebsiteUrl: "https://www.typeform.com/",
  capabilities: [
    {
      ...capability(
        "form_response_read",
        "Read forms and response lifecycle",
        "Read bounded Form metadata and completed Response lifecycle timestamps for one exact Typeform account, workspace, and API region.",
        true,
      ),
      platformCapability: "typeform_form_response_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.typeform.com/oauth/authorize",
      tokenUrl: "https://api.typeform.com/oauth/token",
      refreshUrl: "https://api.typeform.com/oauth/token",
      userInfoUrl: "https://api.typeform.com/me",
      requiredScopes: [
        "accounts:read",
        "workspaces:read",
        "forms:read",
        "responses:read",
        "offline",
      ],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "typeform.listWorkspaceForms",
      functionName: "typeform_form_list_recent",
      aliases: ["typeform.listWorkspaceForms", "typeform_form_list_recent"],
      capability: "form_response_read",
      platformCapability: "typeform_form_response_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five redacted Form summaries from the selected workspace, newest update first.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "typeform.getFormSummary",
      functionName: "typeform_form_get",
      aliases: ["typeform.getFormSummary", "typeform_form_get"],
      capability: "form_response_read",
      platformCapability: "typeform_form_response_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact redacted Form summary without questions, fields, choices, logic, media, variables or tracking.",
      inputSchema: {
        type: "object",
        properties: {
          formId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,64}$",
          },
        },
        required: ["formId"],
        additionalProperties: false,
      },
    },
    {
      name: "typeform.listRecentResponses",
      functionName: "typeform_response_list_recent",
      aliases: [
        "typeform.listRecentResponses",
        "typeform_response_list_recent",
      ],
      capability: "form_response_read",
      platformCapability: "typeform_form_response_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five completed Response IDs and lifecycle timestamps from the previous fourteen days without answers or respondent data.",
      inputSchema: {
        type: "object",
        properties: {
          formId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,64}$",
          },
        },
        required: ["formId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "typeform_safe",
      label: "Safe",
      description:
        "Every bounded Typeform read requires approval; questions, answers, respondent identity, hidden values, metadata, files, payments, webhooks, export and writes are outside Relay's V1 surface.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three selected bounded Typeform reads run without Relay per-action approval; account/workspace/region binding, redaction, first-page bounds, audits, scopes, refresh rotation and rate limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account-workspace-region",
      label:
        "Typeform exact account, selected workspace, and API-region validation",
      requiredScopes: [
        "accounts:read",
        "workspaces:read",
        "forms:read",
        "responses:read",
        "offline",
      ],
    },
  ],
};
