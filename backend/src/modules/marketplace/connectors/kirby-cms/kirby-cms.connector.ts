import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "kirby_cms_selected_page_state_get",
    "Read selected page state",
    "Read only one selected page ID and publication status.",
  ),
];
const guards = [
  blocked(
    "kirby_cms_private_content",
    "Expose content or identities",
    "Titles, slugs, URLs, UUIDs, content, custom fields, files, drafts, children, siblings, users, and identities are excluded from Relay output.",
  ),
  blocked(
    "kirby_cms_mutation",
    "Mutate Kirby CMS",
    "Pages, files, users, roles, languages, site settings, blueprints, drafts, changes, and every PATCH, POST, DELETE, or method override are blocked.",
  ),
  blocked(
    "kirby_cms_broad_access",
    "Use broad Kirby CMS access",
    "Other page IDs, page lists, children, files, users, roles, languages, site, system, custom API routes, redirects, and Panel administration are blocked.",
  ),
];

export const KIRBY_CMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "kirby-cms",
  name: "Kirby CMS",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://getkirby.com/docs/reference/api/pages/get",
  providerWebsiteUrl: "https://getkirby.com/",
  capabilities: [
    {
      ...capability(
        "kirby_cms_selected_page_state_get",
        "Read selected page state",
        "Read bounded state metadata for one selected Kirby CMS page.",
        true,
      ),
      platformCapability: "kirby_cms_selected_page_state_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "KIRBY_CMS_SITE_BASE_URL",
        label: "Kirby CMS HTTPS site base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public HTTPS URL for one customer-operated Kirby CMS site, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
      },
      {
        name: "KIRBY_CMS_USER_EMAIL",
        label: "Dedicated read-only API user email",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The email of a dedicated non-admin custom-role user with API/Panel access, pages read access, and every write and other resource permission disabled.",
      },
      {
        name: "KIRBY_CMS_USER_PASSWORD",
        label: "Dedicated read-only API user password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A unique password used only by the dedicated least-privilege Kirby API user; never use an administrator or human user's credentials.",
      },
      {
        name: "KIRBY_CMS_PAGE_ID",
        label: "Selected page ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact ID of the single canonical page Relay may inspect, with hierarchy slashes replaced by plus signs as required by Kirby's API.",
      },
    ],
  },
  tools: [
    {
      name: "kirby-cms.getSelectedPageState",
      functionName: "kirby_cms_selected_page_state_get",
      aliases: [
        "kirby-cms.getSelectedPageState",
        "kirby_cms_selected_page_state_get",
        "relay_kirby_cms_get_selected_page_state",
      ],
      capability: "kirby_cms_selected_page_state_get",
      platformCapability: "kirby_cms_selected_page_state_get",
      action: "read",
      approvalRequired: false,
      description: "Read only one selected page ID and publication status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "kirby_cms_selected_page_state_read",
      label: "Selected Page State Read",
      description:
        "Read one selected page's ID and publication status; content, identities, other resources, administration, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "kirby_cms_no_access",
      label: "No Access",
      description: "Expose no Kirby CMS actions.",
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
      id: "selected_page_state",
      label: "Kirby CMS core REST API and selected-page validation",
      requiredScopes: ["pages.read", "all writes disabled"],
    },
  ],
};
