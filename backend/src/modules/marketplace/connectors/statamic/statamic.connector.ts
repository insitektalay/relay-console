import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "statamic_selected_entry_state_get",
    "Read selected entry state",
    "Read only one selected entry ID and publication status.",
  ),
];
const guards = [
  blocked(
    "statamic_private_content",
    "Expose content or identities",
    "Titles, slugs, URLs, content, custom fields, authors, relations, assets, dates, revisions, and identities are excluded from Relay output.",
  ),
  blocked(
    "statamic_mutation",
    "Mutate Statamic",
    "Entries, collections, taxonomies, assets, globals, forms, users, configuration, add-ons, and every write are blocked.",
  ),
  blocked(
    "statamic_broad_access",
    "Use broad Statamic access",
    "Entry lists, other entry IDs, other collections, taxonomies, assets, globals, forms, users, GraphQL, custom routes, redirects, and administration are blocked.",
  ),
];

export const STATAMIC_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "statamic",
  name: "Statamic",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://statamic.dev/frontend/rest-api",
  providerWebsiteUrl: "https://statamic.com/",
  capabilities: [
    {
      ...capability(
        "statamic_selected_entry_state_get",
        "Read selected entry state",
        "Read bounded state metadata for one selected Statamic entry.",
        true,
      ),
      platformCapability: "statamic_selected_entry_state_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "STATAMIC_SITE_BASE_URL",
        label: "Statamic HTTPS site base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public HTTPS URL for one customer-operated Statamic site, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
      },
      {
        name: "STATAMIC_API_AUTH_TOKEN",
        label: "Dedicated REST API authentication token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A dedicated long random token for a REST API configuration that enables only the selected collection; never expose users, assets, globals, forms, taxonomies, or other collections.",
      },
      {
        name: "STATAMIC_COLLECTION_HANDLE",
        label: "Selected collection handle",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact handle of the only Statamic collection Relay may address.",
      },
      {
        name: "STATAMIC_ENTRY_ID",
        label: "Selected entry ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact ID of the single canonical entry Relay may inspect.",
      },
    ],
  },
  tools: [
    {
      name: "statamic.getSelectedEntryState",
      functionName: "statamic_selected_entry_state_get",
      aliases: [
        "statamic.getSelectedEntryState",
        "statamic_selected_entry_state_get",
        "relay_statamic_get_selected_entry_state",
      ],
      capability: "statamic_selected_entry_state_get",
      platformCapability: "statamic_selected_entry_state_get",
      action: "read",
      approvalRequired: false,
      description: "Read only one selected entry ID and publication status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "statamic_selected_entry_state_read",
      label: "Selected Entry State Read",
      description:
        "Read one selected entry's ID and publication status; content, identities, other resources, administration, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "statamic_no_access",
      label: "No Access",
      description: "Expose no Statamic actions.",
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
      id: "selected_entry_state",
      label: "Statamic core REST API and selected-entry validation",
      requiredScopes: ["selected collection only", "read only"],
    },
  ],
};
