import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "capsule_crm_party_custom_fields_list",
    "List party custom-field metadata",
    "List at most 100 projected party custom-field definitions from Capsule CRM.",
  ),
];
const blockedActions = [
  blocked(
    "capsule_crm_records",
    "Access CRM records",
    "Parties, people, organisations, opportunities, projects, tasks, activities, history, files, users, teams, and goals are blocked.",
  ),
  blocked(
    "capsule_crm_private_schema_logic",
    "Access private schema logic",
    "Descriptions, data tags, list options, link templates, field values, and full definitions are blocked.",
  ),
  blocked(
    "capsule_crm_mutation_administration",
    "Mutate or administer Capsule CRM",
    "Creates, updates, deletes, imports, exports, tracks, pipelines, milestones, boards, stages, users, teams, and settings changes are blocked.",
  ),
  blocked(
    "capsule_crm_raw_mcp_bulk",
    "Use raw, MCP, or bulk access",
    "Arbitrary entities, paths, filters, embeds, raw responses, beta MCP, later pages, redirects, retries, and bulk access are blocked.",
  ),
];
export const CAPSULE_CRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "capsule-crm",
  name: "Capsule CRM",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.capsulecrm.com/v2/operations/Custom_Field",
  providerWebsiteUrl: "https://capsulecrm.com/",
  capabilities: [
    {
      ...capability(
        "party_custom_field_metadata",
        "List party custom-field metadata",
        "List bounded projected party field identity/type metadata without descriptions, tags, options, values, or CRM records.",
        true,
      ),
      platformCapability: "capsule_crm_party_custom_field_metadata",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CAPSULE_CRM_ACCESS_TOKEN",
        label: "Capsule CRM access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Store a dedicated least-privilege Bearer token only through Relay's encrypted flow.",
      },
    ],
  },
  tools: [
    {
      name: "capsuleCrm.listPartyCustomFields",
      functionName: "capsule_crm_party_custom_fields_list",
      aliases: [
        "capsuleCrm.listPartyCustomFields",
        "capsule_crm_party_custom_fields_list",
      ],
      capability: "party_custom_field_metadata",
      platformCapability: "capsule_crm_party_custom_field_metadata",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Capsule CRM party custom-field metadata.",
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
      id: "capsule_crm_party_custom_field_metadata_safe",
      label: "Safe",
      description:
        "The bounded field-metadata read requires approval; CRM records, private schema logic, writes, administration, MCP, bulk, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded metadata read runs without per-action approval; fixed origin/path/entity/query binding, projection, caps, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "party_custom_field_metadata_read",
      label: "Party custom-field credential check",
    },
  ],
};
