import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "keap_contact_custom_fields_list",
    "List contact custom-field metadata",
    "List at most 100 projected contact custom-field definitions from Keap.",
  ),
];

const blockedActions = [
  blocked(
    "keap_crm_commerce_records",
    "Access CRM or commerce records",
    "Contacts, companies, opportunities, notes, tasks, appointments, files, emails, campaigns, tags, orders, subscriptions, transactions, payment methods, affiliates, and users are blocked.",
  ),
  blocked(
    "keap_private_schema_logic",
    "Access private schema logic",
    "Field options, default values, groups, group names, optional properties, field values, and full model responses are blocked.",
  ),
  blocked(
    "keap_mutation_administration",
    "Mutate or administer Keap",
    "Creates, updates, deletes, email sends, campaign enrollment, tagging, imports, exports, schema changes, payments, and settings changes are blocked.",
  ),
  blocked(
    "keap_raw_bulk",
    "Use raw or bulk API access",
    "Arbitrary paths, filters, searches, raw responses, legacy XML-RPC, later pages, redirects, retries, and bulk access are blocked.",
  ),
];

export const KEAP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "keap",
  name: "Keap",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.keap.com/docs/restv2/",
  providerWebsiteUrl: "https://keap.com/",
  capabilities: [
    {
      ...capability(
        "contact_custom_field_metadata",
        "List contact custom-field metadata",
        "List bounded projected contact field identity/type metadata without options, defaults, groups, optional properties, values, or CRM records.",
        true,
      ),
      platformCapability: "keap_contact_custom_field_metadata",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "KEAP_ACCESS_TOKEN",
        label: "Keap access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Store a dedicated least-privilege Personal Access Token only through Relay's encrypted flow.",
      },
    ],
  },
  tools: [
    {
      name: "keap.listContactCustomFields",
      functionName: "keap_contact_custom_fields_list",
      aliases: [
        "keap.listContactCustomFields",
        "keap_contact_custom_fields_list",
      ],
      capability: "contact_custom_field_metadata",
      platformCapability: "keap_contact_custom_field_metadata",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Keap contact custom-field metadata.",
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
      id: "keap_contact_custom_field_metadata_safe",
      label: "Safe",
      description:
        "The bounded field-metadata read requires approval; CRM/commerce records, private schema logic, writes, administration, bulk, and raw APIs remain blocked.",
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
      id: "contact_custom_field_metadata_read",
      label: "Contact custom-field credential check",
    },
  ],
};
