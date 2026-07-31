import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "juro_templates_list",
    "List template metadata",
    "List at most 50 redacted template lifecycle summaries.",
  ),
  action(
    "juro_template_get",
    "Inspect template metadata",
    "Inspect redacted lifecycle metadata for one explicit template.",
  ),
];
const blockedActions = [
  blocked(
    "juro_private_template_data",
    "Access private template data",
    "Draft and sharing links, internal URLs, fields, values, choices, questions, signing sides, signatures, approvers, approval state, tables, and document content are blocked.",
  ),
  blocked(
    "juro_contract_access",
    "Access or mutate contracts",
    "Contract listing, reads, creation, upload, updates, deletion, signing, sending, PDFs, events, webhooks, and every contract workflow action are blocked.",
  ),
  blocked(
    "juro_account_access",
    "Access account configuration",
    "Users, teams, workspaces, integrations, API-key generation, credentials, billing, and account administration are blocked.",
  ),
  blocked(
    "juro_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary queries, contract sync, pagination, filters, polling, retries, batches, exports, downloads, and provider-response pass-through are blocked.",
  ),
];

export const JURO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "juro",
  name: "Juro",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api-docs.juro.com/",
  providerWebsiteUrl: "https://juro.com/",
  capabilities: [
    {
      ...capability(
        "template_metadata_list",
        "List template metadata",
        "List bounded redacted template lifecycle summaries without private template structure.",
        true,
      ),
      platformCapability: "juro_template_metadata_list",
    },
    {
      ...capability(
        "template_metadata_read",
        "Inspect template metadata",
        "Read one explicit template's redacted lifecycle metadata without fields, people, links, or content.",
        true,
      ),
      platformCapability: "juro_template_metadata_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "JURO_API_ORIGIN",
        label: "Juro API environment",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use exactly https://api.juro.com for production or https://api-sandbox.juro.io for Juro sandbox.",
      },
      {
        name: "JURO_API_KEY",
        label: "Juro API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned key after confirming Juro API terms, user consent, and eligible plan authority.",
      },
    ],
  },
  tools: [
    {
      name: "juro.listTemplates",
      functionName: "juro_templates_list",
      aliases: ["juro.listTemplates", "juro_templates_list"],
      capability: "template_metadata_list",
      platformCapability: "juro_template_metadata_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 50 strictly projected Juro template lifecycle summaries.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 50 } },
        additionalProperties: false,
      },
    },
    {
      name: "juro.getTemplate",
      functionName: "juro_template_get",
      aliases: ["juro.getTemplate", "juro_template_get"],
      capability: "template_metadata_read",
      platformCapability: "juro_template_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read strictly projected lifecycle metadata for one explicit Juro template ID.",
      inputSchema: {
        type: "object",
        properties: {
          templateId: {
            type: "string",
            minLength: 1,
            maxLength: 64,
            pattern: "^[A-Za-z0-9_-]+$",
          },
        },
        required: ["templateId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "juro_read_only",
      label: "Read-only template lifecycle",
      description:
        "Two fixed privacy-redacted template metadata reads run automatically through a customer-owned broad API key.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Customer ownership, customer-managed consent, exact environment, fixed read routes, strict projection, key secrecy, result bounds, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "juro_api_health", label: "Juro API key and exact environment" },
  ],
};
