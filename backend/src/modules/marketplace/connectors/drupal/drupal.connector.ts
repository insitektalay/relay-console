import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "drupal_selected_node_lifecycle_get",
    "Read selected node lifecycle",
    "Read only one selected anonymously visible node's UUID, resource type, publication flag, and lifecycle timestamps.",
  ),
];
const guards = [
  blocked(
    "drupal_private_content",
    "Expose content or private site data",
    "Titles, bodies, summaries, authors, relationships, files, paths, revisions, custom fields, unpublished content, users, configuration, and private site data are excluded.",
  ),
  blocked(
    "drupal_mutation",
    "Mutate Drupal",
    "Nodes, media, files, taxonomy, users, configuration, modules, themes, permissions, and every POST, PATCH, DELETE, upload, or other mutation are blocked.",
  ),
  blocked(
    "drupal_broad_access",
    "Use broad Drupal access",
    "Collections, filters, sorts, pagination, includes, relationships, other entity types or nodes, revisions, translations, arbitrary fields, authentication, redirects, non-core APIs, and bulk access are blocked.",
  ),
];

export const DRUPAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "drupal",
  name: "Drupal",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/fetching-resources-get",
  providerWebsiteUrl: "https://www.drupal.org/",
  capabilities: [
    {
      ...capability(
        "drupal_selected_node_lifecycle_get",
        "Read selected node lifecycle",
        "Read bounded public lifecycle metadata for one selected Drupal node.",
        true,
      ),
      platformCapability: "drupal_selected_node_lifecycle_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "DRUPAL_SITE_BASE_URL",
        label: "Drupal HTTPS site base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public HTTPS URL for one customer-operated Drupal site, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
      },
      {
        name: "DRUPAL_NODE_BUNDLE",
        label: "Selected node bundle machine name",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact lowercase machine name for the selected anonymously visible node's bundle, such as article or page.",
      },
      {
        name: "DRUPAL_NODE_UUID",
        label: "Selected public node UUID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact lowercase canonical UUID of the single anonymously visible node Relay may inspect through Drupal core JSON:API.",
      },
    ],
  },
  tools: [
    {
      name: "drupal.getSelectedNodeLifecycle",
      functionName: "drupal_selected_node_lifecycle_get",
      aliases: [
        "drupal.getSelectedNodeLifecycle",
        "drupal_selected_node_lifecycle_get",
        "relay_drupal_get_selected_node_lifecycle",
      ],
      capability: "drupal_selected_node_lifecycle_get",
      platformCapability: "drupal_selected_node_lifecycle_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only one selected anonymously visible node's UUID, resource type, publication flag, and lifecycle timestamps.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "drupal_public_node_lifecycle_read",
      label: "Public Node Lifecycle Read",
      description:
        "Read one selected public node's sparse lifecycle projection; content, identities, relationships, other resources, authentication, administration, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "drupal_no_access",
      label: "No Access",
      description: "Expose no Drupal actions.",
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
      id: "selected_public_node_lifecycle",
      label: "Drupal core JSON:API and selected public-node validation",
      requiredScopes: [],
    },
  ],
};
