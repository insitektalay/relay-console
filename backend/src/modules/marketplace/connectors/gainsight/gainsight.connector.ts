import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "gainsight_objects_list",
    "List object metadata",
    "List at most 100 object names, labels, types, and low-risk capability flags for one exact tenant.",
  ),
];
const blockedActions = [
  blocked(
    "gainsight_customer_person_data",
    "Access customer or person data",
    "Companies, relationships, people, users, goals, health, lifecycle, activities, and field values are blocked.",
  ),
  blocked(
    "gainsight_private_schema_data",
    "Access private schema data",
    "Key prefixes, field names/descriptions, lookups, dropdown values, permissions, mappings, and write-capability flags are blocked.",
  ),
  blocked(
    "gainsight_mutation_delete",
    "Mutate or delete Gainsight data",
    "Creates, updates, upserts, patches, deletes, events, user management, and administration are blocked.",
  ),
  blocked(
    "gainsight_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary tenants, bulk jobs, exports, chunks, polling, retries, batches, downloads, and response pass-through are blocked.",
  ),
];

export const GAINSIGHT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "gainsight",
  name: "Gainsight",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Data_Management_APIs/Data_Management_APIs",
  providerWebsiteUrl: "https://www.gainsight.com/",
  capabilities: [
    {
      ...capability(
        "object_metadata_inventory",
        "List object metadata",
        "List bounded, strictly projected object metadata without field definitions or record values.",
        true,
      ),
      platformCapability: "gainsight_object_metadata_inventory",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GAINSIGHT_ACCESS_KEY",
        label: "Gainsight access key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "GAINSIGHT_TENANT_ORIGIN",
        label: "Gainsight tenant origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use the exact HTTPS gainsightcloud.com tenant origin.",
      },
    ],
  },
  tools: [
    {
      name: "gainsight.listObjects",
      functionName: "gainsight_objects_list",
      aliases: ["gainsight.listObjects", "gainsight_objects_list"],
      capability: "object_metadata_inventory",
      platformCapability: "gainsight_object_metadata_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Gainsight object metadata for one exact tenant.",
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
      id: "gainsight_object_metadata_safe",
      label: "Safe",
      description:
        "The bounded object-metadata read requires approval; customer/person data, private schema, writes, bulk data, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded object-metadata read runs without Relay per-action approval; exact tenant/path binding, strict projection, response cap, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "object_metadata_read", label: "Object metadata credential check" },
  ],
};
