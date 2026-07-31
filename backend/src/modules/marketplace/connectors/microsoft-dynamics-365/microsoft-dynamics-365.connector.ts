import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MICROSOFT_DYNAMICS_365_SCOPES = [
  "offline_access",
  "user_impersonation",
];

const reads = [
  action(
    "microsoft_dynamics_365_organization_get",
    "Get Dynamics organization",
    "Read fixed safe metadata for the selected Dataverse organization.",
  ),
  action(
    "microsoft_dynamics_365_accounts_list",
    "List Dynamics accounts",
    "Read at most twenty-five fixed-field business account summaries.",
  ),
  action(
    "microsoft_dynamics_365_account_get",
    "Get Dynamics account",
    "Read fixed fields for one explicit prior-result account.",
  ),
  action(
    "microsoft_dynamics_365_opportunities_list",
    "List Dynamics opportunities",
    "Read at most twenty-five fixed-field opportunity pipeline summaries.",
  ),
];
const blockedActions = [
  blocked(
    "microsoft_dynamics_365_contacts_addresses_notes",
    "Read personal or free-text CRM data",
    "Contacts, leads, addresses, emails, phones, activities, notes, attachments, and free text are outside V1.",
  ),
  blocked(
    "microsoft_dynamics_365_owners_users_teams",
    "Read CRM identities",
    "Owners, users, teams, customer lookups, formatted identity annotations, and access details are outside V1.",
  ),
  blocked(
    "microsoft_dynamics_365_custom_tables_columns",
    "Read custom Dataverse data",
    "Custom tables, columns, relationships, alternate keys, and non-standard Sales data are outside V1.",
  ),
  blocked(
    "microsoft_dynamics_365_search_fetchxml_expand",
    "Search or expand Dataverse data",
    "Search, SQL, FetchXML, filters, expansions, aggregates, change tracking, and arbitrary OData are outside V1.",
  ),
  blocked(
    "microsoft_dynamics_365_schema_actions_batch",
    "Inspect schema or invoke operations",
    "Metadata, schema, actions, functions, batch requests, and custom APIs are outside V1.",
  ),
  blocked(
    "microsoft_dynamics_365_mutations_assign_share_merge",
    "Change Dynamics records",
    "Creates, updates, deletes, upserts, assigns, shares, merges, and all other mutations are outside V1.",
  ),
  blocked(
    "microsoft_dynamics_365_application_export_pagination_raw",
    "Use broad or raw access",
    "Application users, other environments, exports, automatic pagination, retries, polling, and raw endpoints are outside V1.",
  ),
];
const id = { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" };

export const MICROSOFT_DYNAMICS_365_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-dynamics-365",
    name: "Microsoft Dynamics 365",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://learn.microsoft.com/power-apps/developer/data-platform/webapi/overview",
    providerWebsiteUrl: "https://www.microsoft.com/dynamics-365",
    capabilities: [
      {
        ...capability(
          "organization_accounts",
          "Read organization and accounts",
          "Review one selected Dynamics organization and bounded standard account metadata.",
          true,
        ),
        platformCapability: "microsoft_dynamics_365_accounts_read",
      },
      {
        ...capability(
          "opportunities",
          "Read opportunity summaries",
          "Review bounded standard opportunity pipeline metadata without customer or owner lookups.",
          true,
        ),
        platformCapability: "microsoft_dynamics_365_opportunities_read",
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
        requiredScopes: MICROSOFT_DYNAMICS_365_SCOPES,
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
        name: "microsoft-dynamics-365.getOrganization",
        functionName: "microsoft_dynamics_365_organization_get",
        aliases: [
          "microsoft-dynamics-365.getOrganization",
          "relay_microsoft_dynamics_365_get_organization",
        ],
        capability: "organization_accounts",
        platformCapability: "microsoft_dynamics_365_accounts_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read fixed safe metadata for the selected Dataverse organization.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-dynamics-365.listAccounts",
        functionName: "microsoft_dynamics_365_accounts_list",
        aliases: [
          "microsoft-dynamics-365.listAccounts",
          "relay_microsoft_dynamics_365_list_accounts",
        ],
        capability: "organization_accounts",
        platformCapability: "microsoft_dynamics_365_accounts_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read at most twenty-five fixed-field business account summaries.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-dynamics-365.getAccount",
        functionName: "microsoft_dynamics_365_account_get",
        aliases: [
          "microsoft-dynamics-365.getAccount",
          "relay_microsoft_dynamics_365_get_account",
        ],
        capability: "organization_accounts",
        platformCapability: "microsoft_dynamics_365_accounts_read",
        action: "read",
        approvalRequired: false,
        description: "Read fixed fields for one explicit prior-result account.",
        inputSchema: {
          type: "object",
          properties: { accountId: id },
          required: ["accountId"],
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-dynamics-365.listOpportunities",
        functionName: "microsoft_dynamics_365_opportunities_list",
        aliases: [
          "microsoft-dynamics-365.listOpportunities",
          "relay_microsoft_dynamics_365_list_opportunities",
        ],
        capability: "opportunities",
        platformCapability: "microsoft_dynamics_365_opportunities_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read at most twenty-five fixed-field opportunity pipeline summaries.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_dynamics_365_safe",
        label: "Safe",
        description:
          "Four selected-environment fixed-field GET reads run automatically; personal data, identities, custom data, search, schema, operations, writes, exports, pagination, and raw access remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same four selected-environment reads run without Relay per-action approval; exact scope, environment binding, fixed projections, limits, audit, and Dataverse controls still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "selected_environment",
        label:
          "Microsoft work-account authorization, exact environment scope, refresh, and standard Sales environment validation",
        requiredScopes: MICROSOFT_DYNAMICS_365_SCOPES,
      },
    ],
  };
