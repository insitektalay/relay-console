import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "ironclad_workflow_schemas_list",
    "List workflow schema metadata",
    "List at most 50 strictly projected workflow schema IDs and names with exact read-only authority.",
  ),
];
const blockedActions = [
  blocked(
    "ironclad_private_schema_data",
    "Access private schema data",
    "Launch-form fields, attributes, formulas, entity mappings, values, questions, approval rules, signing configuration, and raw schema bodies are blocked.",
  ),
  blocked(
    "ironclad_contract_data",
    "Access contract or workflow data",
    "Workflows, records, entities, obligations, contract metadata, documents, attachments, PDFs, DOCX files, people, approvals, signatures, and audit data are blocked.",
  ),
  blocked(
    "ironclad_mutation_admin",
    "Mutate or administer Ironclad",
    "Workflow and record creation or changes, approvals, signatures, uploads, exports, webhooks, SCIM, users, groups, integrations, OAuth clients, credentials, and account administration are blocked.",
  ),
  blocked(
    "ironclad_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary queries, filters, search, pagination, polling, retries, batches, downloads, exports, and provider-response pass-through are blocked.",
  ),
];

export const IRONCLAD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ironclad",
  name: "Ironclad",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.ironcladapp.com/",
  providerWebsiteUrl: "https://ironcladapp.com/",
  capabilities: [
    {
      ...capability(
        "workflow_schema_metadata_list",
        "List workflow schema metadata",
        "List bounded workflow schema IDs and names without launch-form fields or private contract configuration.",
        true,
      ),
      platformCapability: "ironclad_workflow_schema_metadata_list",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "IRONCLAD_API_ORIGIN",
        label: "Ironclad environment origin",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the exact HTTPS origin shown by the customer Ironclad environment, such as https://na1.ironcladapp.com.",
      },
      {
        name: "IRONCLAD_CLIENT_ID",
        label: "Ironclad OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned client-credentials app registered with only public.workflows.readSchemas.",
      },
      {
        name: "IRONCLAD_CLIENT_SECRET",
        label: "Ironclad OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Store the one-time customer-owned client secret only through Relay's encrypted connection flow.",
      },
      {
        name: "IRONCLAD_AS_USER_ID",
        label: "Ironclad as-user ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Bind all requests to one exact authorized Ironclad user or service-account ID whose permissions limit returned schemas.",
      },
    ],
  },
  tools: [
    {
      name: "ironclad.listWorkflowSchemas",
      functionName: "ironclad_workflow_schemas_list",
      aliases: [
        "ironclad.listWorkflowSchemas",
        "ironclad_workflow_schemas_list",
      ],
      capability: "workflow_schema_metadata_list",
      platformCapability: "ironclad_workflow_schema_metadata_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 50 strictly projected workflow schema IDs and names.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 50 } },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "ironclad_schema_read_only",
      label: "Read-only workflow schema metadata",
      description:
        "One fixed workflow-schema metadata read runs with exact public.workflows.readSchemas authority and one bound as-user identity.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Exact scope, environment and user binding, client secrecy, fixed routes, strict projection, bounds, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "exact_scope_client_credentials",
      label:
        "Ironclad client credentials, exact scope, environment, and as-user binding",
    },
  ],
};
