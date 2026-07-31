import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { ADOBE_MARKETO_ENGAGE_OPERATIONS } from "./adobe-marketo-engage-api.adapter";

const read = action(
  "adobe_marketo_engage_read",
  "List Marketo programs",
  "List up to 20 minimized program metadata records from the bound Marketo instance.",
);
const manage = blocked(
  "adobe_marketo_engage_manage",
  "Access people or change Marketo",
  "Leads, people, companies, opportunities, activities, memberships, campaigns, emails, forms, files, tokens, bulk APIs, imports, exports, administration, and all mutations are unavailable.",
);

export const ADOBE_MARKETO_ENGAGE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "adobe-marketo-engage",
    name: "Adobe Marketo Engage",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/authentication",
    providerWebsiteUrl:
      "https://business.adobe.com/products/marketo/adobe-marketo.html",
    capabilities: [
      {
        ...capability(
          "marketing_program_read",
          "Read marketing programs",
          "List a bounded, minimized directory of programs visible to the API-only custom service.",
          true,
        ),
        platformCapability: "adobe_marketo_engage_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "MARKETO_INSTANCE_ORIGIN",
          label: "Marketo instance origin",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The exact HTTPS mktorest.com origin shown under Admin > Integration > Web Services.",
        },
        {
          name: "MARKETO_CLIENT_ID",
          label: "Marketo custom-service client ID",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Client ID for an API-only custom service whose role grants only Read-Only Assets.",
        },
        {
          name: "MARKETO_CLIENT_SECRET",
          label: "Marketo custom-service client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Client secret stored encrypted and submitted only to the bound instance identity endpoint.",
        },
      ],
    },
    tools: [
      {
        name: "adobe-marketo-engage.listPrograms",
        functionName: "adobe_marketo_engage_read",
        aliases: [
          "adobe-marketo-engage.listPrograms",
          "adobe_marketo_engage_read",
        ],
        capability: "marketing_program_read",
        platformCapability: "adobe_marketo_engage_read",
        action: "read",
        approvalRequired: false,
        description:
          "List a bounded page of minimized Marketo program metadata.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...ADOBE_MARKETO_ENGAGE_OPERATIONS],
            },
            offset: { type: "integer", minimum: 0, maximum: 10000 },
            maxReturn: { type: "integer", minimum: 1, maximum: 20 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "adobe_marketo_engage_safe",
        label: "Safe",
        description:
          "One bounded program-directory read runs directly. Person data, broader assets, bulk operations, administration, and every mutation remain blocked.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [],
        blockedActions: [manage],
      },
    ],
    healthChecks: [
      {
        id: "program_directory",
        label:
          "Bound Marketo instance and read-only program-directory validation",
      },
    ],
  };
