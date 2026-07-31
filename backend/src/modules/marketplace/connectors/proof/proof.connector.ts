import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "proof_transaction_list",
    "List Proof transactions",
    "List at most ten bounded transaction status summaries from the connected Proof organization.",
  ),
  action(
    "proof_transaction_get",
    "Get Proof transaction",
    "Read one exact transaction's bounded status summary by Proof transaction ID.",
  ),
];
const guards = [
  blocked(
    "proof_private_transaction_data",
    "Expose private transaction data",
    "Signer, notary, identity, contact, document, annotation, message, access-link, audit-trail, and presigned-URL data are excluded.",
  ),
  blocked(
    "proof_transaction_mutation",
    "Mutate Proof transactions",
    "Creating, activating, updating, deleting, sending, signing, verifying, notarizing, downloading, and webhook administration are blocked.",
  ),
  blocked(
    "proof_broad_access",
    "Use broad Proof access",
    "Real Estate API, child-organization traversal, pagination, arbitrary filters, raw API paths, redirects, and bulk export are blocked.",
  ),
];

export const PROOF_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "proof",
  name: "Proof",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://dev.proof.com/docs/overview",
  providerWebsiteUrl: "https://www.proof.com/",
  capabilities: [
    {
      ...capability(
        "proof_transaction_list",
        "List transaction status",
        "List at most ten transaction status summaries without people, documents, or access links.",
        true,
      ),
      platformCapability: "proof_transaction_list",
    },
    {
      ...capability(
        "proof_transaction_get",
        "Read transaction status",
        "Read one exact transaction status summary without people, documents, or access links.",
        true,
      ),
      platformCapability: "proof_transaction_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PROOF_API_KEY",
        label: "Proof Full Access API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "An organization admin creates a customer-owned Full Access key in Proof Settings. Relay encrypts it and uses only the two bounded read tools.",
      },
    ],
  },
  tools: [
    {
      name: "proof.listTransactions",
      functionName: "proof_transaction_list",
      aliases: [
        "proof.listTransactions",
        "proof_transaction_list",
        "relay_proof_list_transactions",
      ],
      capability: "proof_transaction_list",
      platformCapability: "proof_transaction_list",
      action: "read",
      approvalRequired: false,
      description:
        "List one fixed page of at most ten redacted Proof transaction status summaries.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "proof.getTransaction",
      functionName: "proof_transaction_get",
      aliases: [
        "proof.getTransaction",
        "proof_transaction_get",
        "relay_proof_get_transaction",
      ],
      capability: "proof_transaction_get",
      platformCapability: "proof_transaction_get",
      action: "read",
      approvalRequired: false,
      description: "Read one exact redacted Proof transaction status summary.",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: {
            type: "string",
            pattern: "^ot_[A-Za-z0-9-]{1,100}$",
          },
        },
        required: ["transactionId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "proof_read_only",
      label: "Read Only",
      description:
        "Run the two bounded status reads; private transaction data and all mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "proof_no_access",
      label: "No Access",
      description: "Expose no Proof actions.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [
        ...reads.map((item) =>
          blocked(item.id, item.label, "Blocked by authority preset."),
        ),
        ...guards,
      ],
    },
  ],
  healthChecks: [
    { id: "transactions", label: "Proof API key and organization validation" },
  ],
};
