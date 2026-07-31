import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { MICROSOFT_DYNAMICS_365_SALES_OPERATIONS } from "./microsoft-dynamics-365-sales-api.adapter";

export const MICROSOFT_DYNAMICS_365_SALES_REQUIRED_SCOPES = [
  "offline_access",
  "user_impersonation",
] as const;

const read = action(
  "microsoft_dynamics_365_sales_read",
  "Read Dynamics 365 Sales connection summary",
  "Return only the selected Dataverse environment plus signed-in user, organization, and business-unit IDs.",
);
const manage = blocked(
  "microsoft_dynamics_365_sales_manage",
  "Access sales records or change Dynamics 365 Sales",
  "Accounts, contacts, leads, opportunities, orders, invoices, activities, campaigns, cases, arbitrary Dataverse tables, metadata, queries, actions, and mutations are outside Relay's V1 contract.",
);

export const MICROSOFT_DYNAMICS_365_SALES_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-dynamics-365-sales",
    name: "Microsoft Dynamics 365 Sales",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/web-api-functions-actions-sample",
    providerWebsiteUrl:
      "https://www.microsoft.com/en-us/dynamics-365/products/sales",
    capabilities: [
      {
        ...capability(
          "microsoft_dynamics_365_sales_read",
          "Read connection summary",
          "Verify the selected Dynamics 365 Sales environment and return minimized Dataverse identity IDs.",
          true,
        ),
        platformCapability: "microsoft_dynamics_365_sales_read",
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
        requiredScopes: [...MICROSOFT_DYNAMICS_365_SALES_REQUIRED_SCOPES],
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "DYNAMICS_365_SALES_ENVIRONMENT_URL",
          label: "Dynamics 365 Sales environment URL",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "The exact Dataverse environment origin hosting the customer's Dynamics 365 Sales app.",
        },
        {
          name: "MICROSOFT_DYNAMICS_365_CLIENT_ID",
          label: "Relay Microsoft application client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Relay-owned multi-tenant Entra application ID stored on Railway.",
        },
        {
          name: "MICROSOFT_DYNAMICS_365_CLIENT_SECRET",
          label: "Relay Microsoft application client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText: "Relay-owned Entra client secret stored only on Railway.",
        },
      ],
    },
    tools: [
      {
        name: "microsoft-dynamics-365-sales.getConnectionSummary",
        functionName: "microsoft_dynamics_365_sales_read",
        aliases: [
          "microsoft-dynamics-365-sales.getConnectionSummary",
          "microsoft_dynamics_365_sales_read",
        ],
        capability: "microsoft_dynamics_365_sales_read",
        platformCapability: "microsoft_dynamics_365_sales_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read the minimized Dynamics 365 Sales connection identity.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...MICROSOFT_DYNAMICS_365_SALES_OPERATIONS],
            },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_dynamics_365_sales_safe",
        label: "Safe",
        description:
          "One environment-bound WhoAmI check runs directly. Sales data, arbitrary Dataverse access, and every mutation remain blocked.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [],
        blockedActions: [manage],
      },
    ],
    healthChecks: [
      {
        id: "who_am_i",
        label: "Selected Dataverse environment and signed-in user validation",
        requiredScopes: [...MICROSOFT_DYNAMICS_365_SALES_REQUIRED_SCOPES],
      },
    ],
  };
