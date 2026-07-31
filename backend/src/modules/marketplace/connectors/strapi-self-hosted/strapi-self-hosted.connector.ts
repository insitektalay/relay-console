import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "strapi_self_hosted_selected_document_lifecycle_get",
    "Read selected document lifecycle",
    "Read only one selected published document ID and lifecycle timestamps.",
  ),
];
const guards = [
  blocked(
    "strapi_self_hosted_private_content",
    "Expose content or identities",
    "Titles, slugs, bodies, custom fields, components, dynamic zones, media, relations, locales, users, and identities are excluded from Relay output.",
  ),
  blocked(
    "strapi_self_hosted_mutation",
    "Mutate Strapi",
    "Documents, content types, components, media, users, roles, tokens, settings, plugins, releases, drafts, and every create, update, delete, publish, or unpublish action are blocked.",
  ),
  blocked(
    "strapi_self_hosted_broad_access",
    "Use broad Strapi access",
    "Document lists, other document IDs, other content types, arbitrary fields, filters, population, drafts, locales, GraphQL, uploads, custom routes, redirects, and administration are blocked.",
  ),
];

export const STRAPI_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "strapi-self-hosted",
    name: "Strapi Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://docs.strapi.io/cms/api/rest",
    providerWebsiteUrl: "https://strapi.io/",
    capabilities: [
      {
        ...capability(
          "strapi_self_hosted_selected_document_lifecycle_get",
          "Read selected document lifecycle",
          "Read bounded lifecycle metadata for one selected published Strapi 5 document.",
          true,
        ),
        platformCapability:
          "strapi_self_hosted_selected_document_lifecycle_get",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "STRAPI_SELF_HOSTED_BASE_URL",
          label: "Strapi HTTPS project base URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact public HTTPS URL for one customer-operated Strapi 5 project, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
        },
        {
          name: "STRAPI_SELF_HOSTED_API_TOKEN",
          label: "Dedicated custom findOne API token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "A dedicated expiring custom API token whose only permission is findOne on the selected content type; never use read-only-all or full-access tokens.",
        },
        {
          name: "STRAPI_SELF_HOSTED_CONTENT_TYPE_ROUTE",
          label: "Selected content-type plural route",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact plural route of the only Strapi 5 collection type Relay may address, such as articles.",
        },
        {
          name: "STRAPI_SELF_HOSTED_DOCUMENT_ID",
          label: "Selected document ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact lowercase Strapi 5 documentId of the single published document Relay may inspect.",
        },
      ],
    },
    tools: [
      {
        name: "strapi-self-hosted.getSelectedDocumentLifecycle",
        functionName: "strapi_self_hosted_selected_document_lifecycle_get",
        aliases: [
          "strapi-self-hosted.getSelectedDocumentLifecycle",
          "strapi_self_hosted_selected_document_lifecycle_get",
          "relay_strapi_self_hosted_get_selected_document_lifecycle",
        ],
        capability: "strapi_self_hosted_selected_document_lifecycle_get",
        platformCapability:
          "strapi_self_hosted_selected_document_lifecycle_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read only one selected published document ID and lifecycle timestamps.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "strapi_self_hosted_selected_document_lifecycle_read",
        label: "Selected Document Lifecycle Read",
        description:
          "Read one selected published document's lifecycle projection; content, identities, other resources, administration, drafts, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "strapi_self_hosted_no_access",
        label: "No Access",
        description: "Expose no Strapi actions.",
        defaultSelected: false,
        allowedActions: [],
        approvalRequiredActions: [],
        blockedActions: [
          ...reads.map((item) =>
            blocked(item.id, item.label, "Blocked by authority preset."),
          ),
          ...guards,
        ],
      },
    ],
    healthChecks: [
      {
        id: "selected_document_lifecycle",
        label: "Strapi 5 Content API and selected-document validation",
        requiredScopes: [
          "selected content-type findOne only",
          "published only",
        ],
      },
    ],
  };
