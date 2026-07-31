import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_OPERATIONS } from "./microsoft-dynamics-365-business-central-api.adapter";

export const MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_REQUIRED_SCOPES = [
  "offline_access",
  "https://api.businesscentral.dynamics.com/Financials.ReadWrite.All",
] as const;

const read = action(
  "microsoft_dynamics_365_business_central_read",
  "List Business Central companies",
  "Return up to 50 minimized company identifiers and names from the selected Business Central environment.",
);
const manage = blocked(
  "microsoft_dynamics_365_business_central_manage",
  "Access financial records or change Business Central",
  "Customers, vendors, items, employees, ledgers, journals, accounts, documents, orders, invoices, payments, attachments, reports, custom APIs, arbitrary OData, and all mutations are outside Relay's V1 contract.",
);

export const MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-dynamics-365-business-central",
    name: "Microsoft Dynamics 365 Business Central",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/",
    providerWebsiteUrl:
      "https://www.microsoft.com/en-us/dynamics-365/products/business-central",
    capabilities: [
      {
        ...capability(
          "microsoft_dynamics_365_business_central_read",
          "List companies",
          "Read a bounded, minimized company directory from the selected Business Central environment.",
          true,
        ),
        platformCapability: "microsoft_dynamics_365_business_central_read",
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
        requiredScopes: [
          ...MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_REQUIRED_SCOPES,
        ],
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "BUSINESS_CENTRAL_ENVIRONMENT_NAME",
          label: "Business Central environment name",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "The exact Business Central online environment name, such as Production or Sandbox.",
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
        name: "microsoft-dynamics-365-business-central.listCompanies",
        functionName: "microsoft_dynamics_365_business_central_read",
        aliases: [
          "microsoft-dynamics-365-business-central.listCompanies",
          "microsoft_dynamics_365_business_central_read",
        ],
        capability: "microsoft_dynamics_365_business_central_read",
        platformCapability: "microsoft_dynamics_365_business_central_read",
        action: "read",
        approvalRequired: false,
        description:
          "List a bounded, minimized company directory from the selected Business Central environment.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_OPERATIONS],
            },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_dynamics_365_business_central_safe",
        label: "Safe",
        description:
          "One bounded company-directory read runs directly. Financial and operational records, arbitrary endpoints, pagination, and every mutation remain blocked.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [],
        blockedActions: [manage],
      },
    ],
    healthChecks: [
      {
        id: "companies",
        label: "Selected Business Central environment and company validation",
        requiredScopes: [
          ...MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_REQUIRED_SCOPES,
        ],
      },
    ],
  };
