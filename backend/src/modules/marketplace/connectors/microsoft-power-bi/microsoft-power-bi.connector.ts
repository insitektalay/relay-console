import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MICROSOFT_POWER_BI_SCOPES = [
  "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
  "https://analysis.windows.net/powerbi/api/Report.Read.All",
  "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
];

const reads = [
  action(
    "microsoft_power_bi_workspace_get",
    "Get selected workspace",
    "Read safe metadata for the connection-selected Power BI workspace.",
  ),
  action(
    "microsoft_power_bi_reports_list",
    "List reports",
    "List at most twenty-five report metadata records without URLs or content.",
  ),
  action(
    "microsoft_power_bi_semantic_models_list",
    "List semantic models",
    "List at most twenty-five semantic-model metadata records without data or owner identity.",
  ),
  action(
    "microsoft_power_bi_semantic_model_get",
    "Get semantic model",
    "Read safe metadata for one explicit prior-result semantic model.",
  ),
];
const blockedActions = [
  blocked(
    "microsoft_power_bi_report_content_visuals_data",
    "Read report content or analytics data",
    "Report pages, visuals, definitions, data, subscriptions, and content are outside V1.",
  ),
  blocked(
    "microsoft_power_bi_embed_urls_tokens",
    "Read embed URLs or tokens",
    "Embed URLs, web URLs, embed tokens, and app links are outside V1.",
  ),
  blocked(
    "microsoft_power_bi_dataset_queries_rows_schema",
    "Query semantic-model data",
    "Queries, rows, tables, schema, datasources, parameters, and lineage are outside V1.",
  ),
  blocked(
    "microsoft_power_bi_identities_access_rights",
    "Read identities or access rights",
    "Owners, users, principals, access rights, subscriptions, and sharing details are outside V1.",
  ),
  blocked(
    "microsoft_power_bi_refresh_gateway_capacity_admin",
    "Administer Power BI",
    "Refresh, gateways, capacity, admin APIs, tenant scanning, and permissions are outside V1.",
  ),
  blocked(
    "microsoft_power_bi_exports_downloads_mutations",
    "Export or change Power BI resources",
    "Exports, downloads, imports, publishes, updates, deletes, rebinds, refreshes, and other mutations are outside V1.",
  ),
  blocked(
    "microsoft_power_bi_application_raw_pagination",
    "Use broad or raw access",
    "Application permissions, My workspace, other workspaces, beta or raw endpoints, arbitrary OData, and automatic pagination are outside V1.",
  ),
];
const id = { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" };

export const MICROSOFT_POWER_BI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-power-bi",
    name: "Microsoft Power BI",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://learn.microsoft.com/rest/api/power-bi/",
    providerWebsiteUrl:
      "https://www.microsoft.com/power-platform/products/power-bi",
    capabilities: [
      {
        ...capability(
          "workspace_reports",
          "Read workspace and reports",
          "Review one selected workspace and bounded report metadata.",
          true,
        ),
        platformCapability: "microsoft_power_bi_workspace_reports_read",
      },
      {
        ...capability(
          "semantic_models",
          "Read semantic-model metadata",
          "Review bounded semantic-model names and safe status flags without analytics data.",
          true,
        ),
        platformCapability: "microsoft_power_bi_semantic_models_read",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
        tokenUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
        authority: {
          provider: "microsoft",
          defaultMode: "multi_tenant_org",
          tenantIdEnv: "MICROSOFT_TENANT_ID",
        },
        requiredScopes: MICROSOFT_POWER_BI_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "MICROSOFT_CLIENT_ID",
          label: "Microsoft application client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["oauth"],
          helpText:
            "Relay-owned Entra application ID configured only on Railway.",
        },
        {
          name: "MICROSOFT_CLIENT_SECRET",
          label: "Microsoft application client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["oauth"],
          helpText: "Relay-owned Entra secret retained only by Railway.",
        },
      ],
    },
    tools: [
      {
        name: "microsoft-power-bi.getWorkspace",
        functionName: "microsoft_power_bi_workspace_get",
        aliases: [
          "microsoft-power-bi.getWorkspace",
          "relay_microsoft_power_bi_get_workspace",
        ],
        capability: "workspace_reports",
        platformCapability: "microsoft_power_bi_workspace_reports_read",
        action: "read",
        approvalRequired: false,
        description: "Read safe metadata for the selected Power BI workspace.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-power-bi.listReports",
        functionName: "microsoft_power_bi_reports_list",
        aliases: [
          "microsoft-power-bi.listReports",
          "relay_microsoft_power_bi_list_reports",
        ],
        capability: "workspace_reports",
        platformCapability: "microsoft_power_bi_workspace_reports_read",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five report metadata records without URLs or content.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-power-bi.listSemanticModels",
        functionName: "microsoft_power_bi_semantic_models_list",
        aliases: [
          "microsoft-power-bi.listSemanticModels",
          "relay_microsoft_power_bi_list_semantic_models",
        ],
        capability: "semantic_models",
        platformCapability: "microsoft_power_bi_semantic_models_read",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five semantic-model metadata records without data or owner identity.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-power-bi.getSemanticModel",
        functionName: "microsoft_power_bi_semantic_model_get",
        aliases: [
          "microsoft-power-bi.getSemanticModel",
          "relay_microsoft_power_bi_get_semantic_model",
        ],
        capability: "semantic_models",
        platformCapability: "microsoft_power_bi_semantic_models_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read safe metadata for one explicit prior-result semantic model.",
        inputSchema: {
          type: "object",
          properties: { semanticModelId: id },
          required: ["semanticModelId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_power_bi_safe",
        label: "Safe",
        description:
          "Four selected-workspace metadata reads run automatically; content, data, URLs, identities, administration, exports, writes, application access, pagination, and raw APIs remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same four selected-workspace reads run without Relay per-action approval; exact scopes, binding, limits, projection, audit, and Power BI controls still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "selected_workspace",
        label:
          "Microsoft work-account authorization, exact scopes, refresh, and selected Power BI workspace validation",
        requiredScopes: MICROSOFT_POWER_BI_SCOPES,
      },
    ],
  };
