import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "contractbook_document_lifecycles_list",
    "List document lifecycles",
    "List at most 25 strictly projected document IDs, types, states, and lifecycle timestamps.",
  ),
];
const blockedActions = [
  blocked(
    "contractbook_private_document_data",
    "Access private document data",
    "Titles, owners, parties, signees, emails, addresses, numbers, messages, data fields, tags, folders, workspaces, permissions, comments, tasks, and document content are blocked.",
  ),
  blocked(
    "contractbook_files_sharing_signing",
    "Access files, sharing, or signing",
    "PDFs, attachments, download links, uploads, collaborators, sharing, signature requests, signing, resending, and webhook payloads are blocked.",
  ),
  blocked(
    "contractbook_mutation_admin",
    "Mutate or administer Contractbook",
    "Draft creation, template use, document updates or deletion, automations, space changes, API-key management, and administration are blocked.",
  ),
  blocked(
    "contractbook_raw_bulk",
    "Use raw or bulk access",
    "Full responses, raw paths, arbitrary filters, cursors, pagination, polling, retries, batches, exports, and provider-response pass-through are blocked.",
  ),
];

export const CONTRACTBOOK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "contractbook",
  name: "Contractbook",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.contractbook.com/v3/docs/index.html",
  providerWebsiteUrl: "https://contractbook.com/",
  capabilities: [
    {
      ...capability(
        "document_lifecycle_metadata_list",
        "List document lifecycles",
        "List bounded document IDs, types, states, and lifecycle timestamps without titles, people, fields, files, or cursors.",
        true,
      ),
      platformCapability: "contractbook_document_lifecycle_metadata_list",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CONTRACTBOOK_API_KEY",
        label: "Contractbook API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated customer-owned production API key in Contractbook profile settings and store the one-time value only through Relay's encrypted connection flow.",
      },
    ],
  },
  tools: [
    {
      name: "contractbook.listDocumentLifecycles",
      functionName: "contractbook_document_lifecycles_list",
      aliases: [
        "contractbook.listDocumentLifecycles",
        "contractbook_document_lifecycles_list",
      ],
      capability: "document_lifecycle_metadata_list",
      platformCapability: "contractbook_document_lifecycle_metadata_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 strictly projected Contractbook document IDs, types, states, and lifecycle timestamps.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "contractbook_lifecycle_read_only",
      label: "Read-only document lifecycle metadata",
      description:
        "One fixed privacy-redacted production document list runs automatically through a customer-owned API key.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Customer ownership, production binding, fixed route and query, key secrecy, strict projection, result bounds, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "production_document_list",
      label: "Contractbook production API key and bounded document-list access",
    },
  ],
};
