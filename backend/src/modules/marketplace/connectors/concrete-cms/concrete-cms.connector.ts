import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "concrete_cms_selected_page_lifecycle_get",
    "Read selected page lifecycle",
    "Read only one selected page ID plus its added and last-updated timestamps.",
  ),
];
const guards = [
  blocked(
    "concrete_cms_private_content",
    "Expose content or private site data",
    "Page names, paths, descriptions, templates, types, locales, external links, attributes, areas, blocks, content, files, versions, users, and private site data are excluded from Relay output.",
  ),
  blocked(
    "concrete_cms_mutation",
    "Mutate Concrete CMS",
    "Pages, blocks, files, users, groups, sites, versions, configuration, and every POST, PUT, PATCH, DELETE, upload, or other mutation are blocked.",
  ),
  blocked(
    "concrete_cms_broad_access",
    "Use broad Concrete CMS access",
    "Page collections, other page IDs, includes, recent or other versions, areas, blocks, files, users, groups, sites, system information, custom routes, redirects, and administration are blocked.",
  ),
];

export const CONCRETE_CMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "concrete-cms",
  name: "Concrete CMS",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://documentation.concretecms.org/9-x/developers/rest-api/concrete-cms-rest-api-endpoints",
  providerWebsiteUrl: "https://www.concretecms.org/",
  capabilities: [
    {
      ...capability(
        "concrete_cms_selected_page_lifecycle_get",
        "Read selected page lifecycle",
        "Read bounded lifecycle metadata for one selected Concrete CMS page.",
        true,
      ),
      platformCapability: "concrete_cms_selected_page_lifecycle_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CONCRETE_CMS_SITE_BASE_URL",
        label: "Concrete CMS HTTPS site base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public HTTPS URL for one customer-operated Concrete CMS 9.2+ installation, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
      },
      {
        name: "CONCRETE_CMS_ACCESS_TOKEN",
        label: "Dedicated pages:read access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A dedicated Concrete CMS OAuth2 access token granted exactly pages:read for the required site; do not grant page writes, content includes, file, user, group, site, system, OpenID, or administration scopes.",
      },
      {
        name: "CONCRETE_CMS_PAGE_ID",
        label: "Selected page ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact positive numeric ID of the single page Relay may inspect through the fixed core REST API individual-page route.",
      },
    ],
  },
  tools: [
    {
      name: "concrete-cms.getSelectedPageLifecycle",
      functionName: "concrete_cms_selected_page_lifecycle_get",
      aliases: [
        "concrete-cms.getSelectedPageLifecycle",
        "concrete_cms_selected_page_lifecycle_get",
        "relay_concrete_cms_get_selected_page_lifecycle",
      ],
      capability: "concrete_cms_selected_page_lifecycle_get",
      platformCapability: "concrete_cms_selected_page_lifecycle_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only one selected page ID plus its added and last-updated timestamps.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "concrete_cms_selected_page_lifecycle_read",
      label: "Selected Page Lifecycle Read",
      description:
        "Read one selected page's lifecycle projection; content, identities, other resources, administration, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "concrete_cms_no_access",
      label: "No Access",
      description: "Expose no Concrete CMS actions.",
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
      id: "selected_page_lifecycle",
      label: "Concrete CMS core REST API and selected-page validation",
      requiredScopes: ["pages:read"],
    },
  ],
};
