import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "clientsuccess_client_custom_fields_list",
    "List client custom-field metadata",
    "List at most 100 projected custom-field definitions for Client resources.",
  ),
];

const blockedActions = [
  blocked(
    "clientsuccess_customer_contact_data",
    "Access customer or contact data",
    "Clients, contacts, account teams, external identifiers, custom-field values, and personal data are blocked.",
  ),
  blocked(
    "clientsuccess_health_revenue_engagement",
    "Access health, revenue, or engagement data",
    "Pulse, contracts, products, subscriptions, usage, surveys, notes, tasks, projects, and engagement are blocked.",
  ),
  blocked(
    "clientsuccess_mutation_administration",
    "Mutate or administer ClientSuccess",
    "Creates, updates, deletes, upserts, imports, exports, attachments, user administration, and integration changes are blocked.",
  ),
  blocked(
    "clientsuccess_raw_bulk",
    "Use raw or bulk API access",
    "Arbitrary paths, resource types, query flags, raw responses, bulk operations, pagination, retries, and pass-through are blocked.",
  ),
];

export const CLIENTSUCCESS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clientsuccess",
  name: "ClientSuccess",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://clientsuccess.readme.io/reference/getcustomfieldsbyresource",
  providerWebsiteUrl: "https://www.clientsuccess.com/",
  capabilities: [
    {
      ...capability(
        "client_custom_field_metadata",
        "List client custom-field metadata",
        "List bounded projected field metadata without values, usage counts, placeholders, options, or customer records.",
        true,
      ),
      platformCapability: "clientsuccess_client_custom_field_metadata",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CLIENTSUCCESS_AUTHORIZATION",
        label: "ClientSuccess Authorization value",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Store the complete value required by ClientSuccess in the Authorization header.",
      },
    ],
  },
  tools: [
    {
      name: "clientsuccess.listClientCustomFields",
      functionName: "clientsuccess_client_custom_fields_list",
      aliases: [
        "clientsuccess.listClientCustomFields",
        "clientsuccess_client_custom_fields_list",
      ],
      capability: "client_custom_field_metadata",
      platformCapability: "clientsuccess_client_custom_field_metadata",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected ClientSuccess client custom-field metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100, default: 100 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "clientsuccess_client_custom_field_metadata_safe",
      label: "Safe",
      description:
        "The bounded client field-metadata read requires approval; customer data, health, revenue, engagement, writes, administration, bulk, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded metadata read runs without per-action approval; fixed origin/path/resource/query binding, projection, caps, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "client_custom_field_metadata_read",
      label: "Client custom-field credential check",
    },
  ],
};
