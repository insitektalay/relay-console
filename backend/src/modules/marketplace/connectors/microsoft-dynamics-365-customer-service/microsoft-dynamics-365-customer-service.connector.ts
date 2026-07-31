import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_OPERATIONS } from "./microsoft-dynamics-365-customer-service-api.adapter";

export const MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_REQUIRED_SCOPES = [
  "offline_access",
  "user_impersonation",
] as const;

const read = action(
  "microsoft_dynamics_365_customer_service_read",
  "Read Customer Service connection summary",
  "Return only the bound environment plus signed-in user, organization, and business-unit IDs.",
);
const manage = blocked(
  "microsoft_dynamics_365_customer_service_manage",
  "Access support data or change Customer Service",
  "Cases, customers, interactions, conversations, channels, knowledge, routing, SLAs, entitlements, analytics, arbitrary Dataverse access, and mutations are outside Relay's V1 contract.",
);

export const MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-dynamics-365-customer-service",
    name: "Microsoft Dynamics 365 Customer Service",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/whoami?view=dataverse-latest",
    providerWebsiteUrl:
      "https://www.microsoft.com/en-us/dynamics-365/products/customer-service",
    capabilities: [
      {
        ...capability(
          "microsoft_dynamics_365_customer_service_read",
          "Read connection summary",
          "Verify the selected Customer Service environment and return minimized Dataverse identity IDs.",
          true,
        ),
        platformCapability: "microsoft_dynamics_365_customer_service_read",
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
          ...MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_REQUIRED_SCOPES,
        ],
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "DYNAMICS_365_CUSTOMER_SERVICE_ENVIRONMENT_URL",
          label: "Customer Service environment URL",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "The exact Dataverse environment origin hosting the customer's Dynamics 365 Customer Service app.",
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
        name: "microsoft-dynamics-365-customer-service.getConnectionSummary",
        functionName: "microsoft_dynamics_365_customer_service_read",
        aliases: [
          "microsoft-dynamics-365-customer-service.getConnectionSummary",
          "microsoft_dynamics_365_customer_service_read",
        ],
        capability: "microsoft_dynamics_365_customer_service_read",
        platformCapability: "microsoft_dynamics_365_customer_service_read",
        action: "read",
        approvalRequired: false,
        description: "Read the minimized Customer Service connection identity.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_OPERATIONS],
            },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_dynamics_365_customer_service_safe",
        label: "Safe",
        description:
          "One environment-bound WhoAmI check runs directly. Customer and support data, arbitrary Dataverse access, and every mutation remain blocked.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [],
        blockedActions: [manage],
      },
    ],
    healthChecks: [
      {
        id: "who_am_i",
        label: "Selected Customer Service environment and user validation",
        requiredScopes: [
          ...MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_REQUIRED_SCOPES,
        ],
      },
    ],
  };
