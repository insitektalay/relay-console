import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "directus_self_hosted_selected_item_state_get",
    "Read selected item state",
    "Read only one selected item ID and status.",
  ),
];
const guards = [
  blocked(
    "directus_self_hosted_private_content",
    "Expose content or identities",
    "Titles, bodies, custom fields, relations, files, revisions, versions, users, and identities are excluded from Relay output.",
  ),
  blocked(
    "directus_self_hosted_mutation",
    "Mutate Directus",
    "Items, collections, fields, files, users, roles, policies, permissions, flows, settings, schema, and every write or share action are blocked.",
  ),
  blocked(
    "directus_self_hosted_broad_access",
    "Use broad Directus access",
    "Item lists, other item keys, other collections, arbitrary fields or filters, GraphQL, realtime, assets, system endpoints, extensions, redirects, and administration are blocked.",
  ),
];

export const DIRECTUS_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "directus-self-hosted",
    name: "Directus Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://directus.io/docs/api/items",
    providerWebsiteUrl: "https://directus.io/",
    capabilities: [
      {
        ...capability(
          "directus_self_hosted_selected_item_state_get",
          "Read selected item state",
          "Read bounded state metadata for one selected Directus item.",
          true,
        ),
        platformCapability: "directus_self_hosted_selected_item_state_get",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "DIRECTUS_SELF_HOSTED_BASE_URL",
          label: "Directus HTTPS instance base URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact public HTTPS URL for one customer-operated Directus instance, including its install path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
        },
        {
          name: "DIRECTUS_SELF_HOSTED_STATIC_TOKEN",
          label: "Dedicated selected-item read token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "A dedicated non-admin user's static token whose only policy grants read access to id and status on the selected collection with an exact selected-item filter; rotate it as a long-lived secret.",
        },
        {
          name: "DIRECTUS_SELF_HOSTED_COLLECTION",
          label: "Selected collection",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact non-system collection whose policy exposes only the selected item's id and status fields.",
        },
        {
          name: "DIRECTUS_SELF_HOSTED_ITEM_KEY",
          label: "Selected item key",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact primary key of the single canonical item Relay may inspect; the collection must use conventional id and status fields.",
        },
      ],
    },
    tools: [
      {
        name: "directus-self-hosted.getSelectedItemState",
        functionName: "directus_self_hosted_selected_item_state_get",
        aliases: [
          "directus-self-hosted.getSelectedItemState",
          "directus_self_hosted_selected_item_state_get",
          "relay_directus_self_hosted_get_selected_item_state",
        ],
        capability: "directus_self_hosted_selected_item_state_get",
        platformCapability: "directus_self_hosted_selected_item_state_get",
        action: "read",
        approvalRequired: false,
        description: "Read only one selected item ID and status.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "directus_self_hosted_selected_item_state_read",
        label: "Selected Item State Read",
        description:
          "Read one selected item's ID and status; content, identities, other resources, administration, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "directus_self_hosted_no_access",
        label: "No Access",
        description: "Expose no Directus actions.",
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
        id: "selected_item_state",
        label: "Directus core REST API and selected-item validation",
        requiredScopes: [
          "selected collection and item read",
          "id and status fields only",
        ],
      },
    ],
  };
