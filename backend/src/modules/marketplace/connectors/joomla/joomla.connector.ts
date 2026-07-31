import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "joomla_selected_article_lifecycle_get",
    "Read selected article lifecycle",
    "Read only one selected article ID, publication state, and lifecycle timestamps.",
  ),
];
const guards = [
  blocked(
    "joomla_private_content",
    "Expose content or private site data",
    "Titles, article text, aliases, notes, authors, categories, tags, images, metadata, custom fields, access rules, URLs, identities, and private site data are excluded from Relay output.",
  ),
  blocked(
    "joomla_mutation",
    "Mutate Joomla",
    "Articles, categories, media, users, configuration, extensions, templates, permissions, and every POST, PATCH, DELETE, upload, or other mutation are blocked.",
  ),
  blocked(
    "joomla_broad_access",
    "Use broad Joomla access",
    "Article collections, other article IDs, categories, fields, content history, users, menus, modules, templates, extensions, arbitrary routes or queries, redirects, and administration are blocked.",
  ),
];

export const JOOMLA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "joomla",
  name: "Joomla",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://manual.joomla.org/docs/4.4/general-concepts/webservices/",
  providerWebsiteUrl: "https://www.joomla.org/",
  capabilities: [
    {
      ...capability(
        "joomla_selected_article_lifecycle_get",
        "Read selected article lifecycle",
        "Read bounded lifecycle metadata for one selected Joomla article.",
        true,
      ),
      platformCapability: "joomla_selected_article_lifecycle_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "JOOMLA_SITE_BASE_URL",
        label: "Joomla HTTPS site base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public HTTPS URL for one customer-operated Joomla installation, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
      },
      {
        name: "JOOMLA_API_TOKEN",
        label: "Dedicated read-only Joomla API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A dedicated non-Super-User token whose account has Web Services Login and only the minimum view access needed for the selected article; do not grant create, edit, delete, configuration, extension, or administration rights.",
      },
      {
        name: "JOOMLA_ARTICLE_ID",
        label: "Selected article ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact positive numeric ID of the single Joomla article Relay may inspect through the fixed core Web Services article route.",
      },
    ],
  },
  tools: [
    {
      name: "joomla.getSelectedArticleLifecycle",
      functionName: "joomla_selected_article_lifecycle_get",
      aliases: [
        "joomla.getSelectedArticleLifecycle",
        "joomla_selected_article_lifecycle_get",
        "relay_joomla_get_selected_article_lifecycle",
      ],
      capability: "joomla_selected_article_lifecycle_get",
      platformCapability: "joomla_selected_article_lifecycle_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only one selected article ID, publication state, and lifecycle timestamps.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "joomla_selected_article_lifecycle_read",
      label: "Selected Article Lifecycle Read",
      description:
        "Read one selected article's lifecycle projection; content, identities, other resources, administration, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "joomla_no_access",
      label: "No Access",
      description: "Expose no Joomla actions.",
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
      id: "selected_article_lifecycle",
      label: "Joomla Web Services and selected-article validation",
      requiredScopes: ["core.login.api"],
    },
  ],
};
