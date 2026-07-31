import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "vitally_custom_traits_list",
    "List custom trait schemas",
    "List at most 100 custom-trait IDs, labels, paths, types, and creation timestamps for one approved model.",
  ),
];
const blockedActions = [
  blocked(
    "vitally_customer_records",
    "Access customer records",
    "Organizations, accounts, users, admins, identities, revenue, health, lifecycle, NPS, and trait values are blocked.",
  ),
  blocked(
    "vitally_activity_content",
    "Access activity or content",
    "Meetings, conversations, messages, notes, projects, tasks, surveys, responses, attachments, and recordings are blocked.",
  ),
  blocked(
    "vitally_mutation_delete",
    "Mutate or delete Vitally data",
    "Creates, updates, analytics ingestion, imports, bulk requests, unlinking, deletes, and administration are blocked.",
  ),
  blocked(
    "vitally_raw_bulk",
    "Use raw or bulk access",
    "Custom-object schemas, configured options, raw paths, arbitrary origins, pagination, retries, batches, exports, and response pass-through are blocked.",
  ),
];

export const VITALLY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vitally",
  name: "Vitally",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.vitally.io/en/articles/9880864-rest-api-custom-traits",
  providerWebsiteUrl: "https://www.vitally.io/",
  capabilities: [
    {
      ...capability(
        "custom_trait_schema",
        "List custom trait schemas",
        "List bounded, strictly projected custom-trait definitions without values or customer records.",
        true,
      ),
      platformCapability: "vitally_custom_trait_schema",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VITALLY_REST_API_KEY",
        label: "Vitally REST API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "VITALLY_REST_API_ORIGIN",
        label: "Vitally REST API origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the exact https://{subdomain}.rest.vitally.io US origin or https://rest.vitally-eu.io EU origin.",
      },
    ],
  },
  tools: [
    {
      name: "vitally.listCustomTraits",
      functionName: "vitally_custom_traits_list",
      aliases: ["vitally.listCustomTraits", "vitally_custom_traits_list"],
      capability: "custom_trait_schema",
      platformCapability: "vitally_custom_trait_schema",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Vitally custom-trait schemas for one approved model.",
      inputSchema: {
        type: "object",
        properties: {
          model: {
            type: "string",
            enum: [
              "users",
              "accounts",
              "organizations",
              "tasks",
              "notes",
              "projects",
              "conversations",
              "team",
            ],
          },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 100 },
        },
        required: ["model"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "vitally_custom_trait_schema_safe",
      label: "Safe",
      description:
        "The bounded trait-schema read requires approval; customer records, activities, values, writes, deletes, bulk data, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded trait-schema read runs without Relay per-action approval; exact origin/model binding, strict projection, response cap, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "custom_trait_schema_read", label: "Custom-trait credential check" },
  ],
};
