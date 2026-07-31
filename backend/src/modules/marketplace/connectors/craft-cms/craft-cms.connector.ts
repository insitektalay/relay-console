import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "craft_cms_selected_entry_lifecycle_get",
    "Read selected entry lifecycle",
    "Read only one selected entry UUID, status, and lifecycle timestamps.",
  ),
];
const guards = [
  blocked(
    "craft_cms_private_content",
    "Expose content or private project data",
    "Titles, slugs, URIs, authors, post dates, expiry dates, custom fields, relations, assets, drafts, revisions, and private project data are excluded from Relay output.",
  ),
  blocked(
    "craft_cms_mutation",
    "Mutate Craft CMS",
    "Entries, drafts, revisions, assets, categories, tags, users, globals, project configuration, plugins, and every GraphQL mutation or other write are blocked.",
  ),
  blocked(
    "craft_cms_broad_access",
    "Use broad Craft CMS access",
    "Entry collections, other entry UUIDs, other sections, assets, categories, tags, users, global sets, arbitrary GraphQL documents, introspection, aliases, directives, batching, redirects, and administration are blocked.",
  ),
];

export const CRAFT_CMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "craft-cms",
  name: "Craft CMS",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://craftcms.com/docs/5.x/development/graphql",
  providerWebsiteUrl: "https://craftcms.com/",
  capabilities: [
    {
      ...capability(
        "craft_cms_selected_entry_lifecycle_get",
        "Read selected entry lifecycle",
        "Read bounded lifecycle metadata for one selected Craft CMS entry.",
        true,
      ),
      platformCapability: "craft_cms_selected_entry_lifecycle_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CRAFT_CMS_SITE_BASE_URL",
        label: "Craft CMS HTTPS site base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public HTTPS URL for one customer-operated Craft CMS project, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
      },
      {
        name: "CRAFT_CMS_GRAPHQL_TOKEN",
        label: "Dedicated read-only GraphQL schema token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A dedicated private-schema token whose schema permits reading only the selected entry's section and permits no mutations; never use the control-panel Full Schema.",
      },
      {
        name: "CRAFT_CMS_ENTRY_UID",
        label: "Selected entry UUID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact lowercase UUID of the single canonical entry Relay may inspect through its fixed GraphQL query.",
      },
    ],
  },
  tools: [
    {
      name: "craft-cms.getSelectedEntryLifecycle",
      functionName: "craft_cms_selected_entry_lifecycle_get",
      aliases: [
        "craft-cms.getSelectedEntryLifecycle",
        "craft_cms_selected_entry_lifecycle_get",
        "relay_craft_cms_get_selected_entry_lifecycle",
      ],
      capability: "craft_cms_selected_entry_lifecycle_get",
      platformCapability: "craft_cms_selected_entry_lifecycle_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only one selected entry UUID, status, and lifecycle timestamps.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "craft_cms_selected_entry_lifecycle_read",
      label: "Selected Entry Lifecycle Read",
      description:
        "Read one selected entry's lifecycle projection; content, identities, other resources, administration, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "craft_cms_no_access",
      label: "No Access",
      description: "Expose no Craft CMS actions.",
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
      id: "selected_entry_lifecycle",
      label: "Craft CMS core GraphQL API and selected-entry validation",
      requiredScopes: ["selected-section entry query", "no mutations"],
    },
  ],
};
