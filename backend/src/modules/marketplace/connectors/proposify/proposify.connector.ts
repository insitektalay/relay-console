import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "proposify_document_get",
    "Inspect document metadata",
    "Inspect privacy-redacted lifecycle metadata for one explicit Proposify V3 document UUID.",
  ),
];
const blockedActions = [
  blocked(
    "proposify_private_content",
    "Access private proposal content",
    "Document bodies, sections, fees, signatures, recipients, contacts, companies, users, client data, PDFs, links, and custom fields are blocked.",
  ),
  blocked(
    "proposify_mutation",
    "Mutate or send documents",
    "Creation, section changes, updates, sending, signing, approval, won/lost transitions, deletion, and downloads are blocked.",
  ),
  blocked(
    "proposify_broader_authority",
    "Use broader OAuth authority",
    "Events, legacy documents, templates, companies, users, admin/client management, credential rotation, and scopes beyond read_documents are blocked.",
  ),
  blocked(
    "proposify_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary queries, pagination, polling, retries, batches, exports, and provider-response pass-through are blocked.",
  ),
];

export const PROPOSIFY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "proposify",
  name: "Proposify",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://apidocs.proposify.com/",
  providerWebsiteUrl: "https://www.proposify.com/",
  capabilities: [
    {
      ...capability(
        "document_metadata_read",
        "Inspect document metadata",
        "Read one explicit V3 document's redacted lifecycle metadata with exactly read_documents authority.",
        true,
      ),
      platformCapability: "proposify_document_metadata_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PROPOSIFY_CLIENT_ID",
        label: "Proposify Connect client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate the sole customer-owned API connection in Proposify Connect settings.",
      },
      {
        name: "PROPOSIFY_CLIENT_SECRET",
        label: "Proposify Connect client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the generated confidential client secret and store it only in Relay's encrypted boundary.",
      },
    ],
  },
  tools: [
    {
      name: "proposify.getDocument",
      functionName: "proposify_document_get",
      aliases: ["proposify.getDocument", "proposify_document_get"],
      capability: "document_metadata_read",
      platformCapability: "proposify_document_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read redacted lifecycle metadata for one explicit Proposify V3 document UUID.",
      inputSchema: {
        type: "object",
        properties: {
          documentId: {
            type: "string",
            minLength: 36,
            maxLength: 36,
            pattern:
              "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
          },
        },
        required: ["documentId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "proposify_read_only",
      label: "Read-only document lifecycle",
      description:
        "One fixed privacy-redacted V3 document metadata lookup runs automatically with exactly read_documents authority.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Exact scope, customer-owned client boundary, fixed token and document routes, strict projection, and read-only behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "client_credentials",
      label:
        "Proposify Connect client credentials and read_documents token exchange",
      requiredScopes: ["read_documents"],
    },
  ],
};
