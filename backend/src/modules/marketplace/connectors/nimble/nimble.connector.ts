import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "nimble_contact_fields_list",
    "List contact-field metadata",
    "List at most 100 projected contact-field definitions from Nimble.",
  ),
];
const blockedActions = [
  blocked(
    "nimble_contact_deal_message_data",
    "Access CRM or message data",
    "Contacts, companies, tags, notes, activities, deals, pipelines, messages, drafts, and relationship data are blocked.",
  ),
  blocked(
    "nimble_private_schema_logic",
    "Access private schema logic",
    "Presentation settings, validation rules, choices, possible actions, logos, IDs for layout containers, and full metadata are blocked.",
  ),
  blocked(
    "nimble_mutation_administration",
    "Mutate or administer Nimble",
    "Creates, updates, deletes, imports, exports, enrichment, email drafts, fields, groups, tabs, choices, pipelines, and settings changes are blocked.",
  ),
  blocked(
    "nimble_raw_bulk",
    "Use raw or bulk API access",
    "Arbitrary paths, searches, raw responses, bulk access, pagination, redirects, and retries are blocked.",
  ),
];

export const NIMBLE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "nimble",
  name: "Nimble",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.nimble.com/developers/docs/",
  providerWebsiteUrl: "https://www.nimble.com/",
  capabilities: [
    {
      ...capability(
        "contact_field_metadata",
        "List contact-field metadata",
        "List bounded projected tab/group/field identity and type metadata without private presentation, validation, choices, actions, or contact records.",
        true,
      ),
      platformCapability: "nimble_contact_field_metadata",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "NIMBLE_API_KEY",
        label: "Nimble API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated least-privilege API key and store it only through Relay's encrypted flow.",
      },
    ],
  },
  tools: [
    {
      name: "nimble.listContactFields",
      functionName: "nimble_contact_fields_list",
      aliases: ["nimble.listContactFields", "nimble_contact_fields_list"],
      capability: "contact_field_metadata",
      platformCapability: "nimble_contact_field_metadata",
      action: "read",
      approvalRequired: true,
      description: "List strictly projected Nimble contact-field metadata.",
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
      id: "nimble_contact_field_metadata_safe",
      label: "Safe",
      description:
        "The bounded field-metadata read requires approval; CRM/message data, private schema logic, writes, administration, bulk, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded metadata read runs without per-action approval; fixed origin/path binding, projection, caps, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "contact_field_metadata_read",
      label: "Contact-field credential check",
    },
  ],
};
