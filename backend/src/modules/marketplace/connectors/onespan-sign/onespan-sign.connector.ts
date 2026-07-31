import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "onespan_sign_transaction_list",
    "List transactions",
    "List up to 25 first-page transaction lifecycle summaries for one explicit status.",
  ),
  action(
    "onespan_sign_transaction_get",
    "Inspect a transaction",
    "Inspect lifecycle metadata for one explicit transaction ID.",
  ),
];
const blockedActions = [
  blocked(
    "onespan_sign_private_content",
    "Access private transaction content",
    "Documents, files, evidence, audit data, roles, recipients, signers, messages, fields, signing URLs, authentication data, and signatures are blocked.",
  ),
  blocked(
    "onespan_sign_mutation",
    "Mutate or sign transactions",
    "Creating, sending, signing, reminding, archiving, deleting, uploading, updating, and administering are blocked.",
  ),
  blocked(
    "onespan_sign_broad_credential_use",
    "Use broad account authority",
    "OneSpan does not yet provide OAuth scopes; Relay confines the customer-owned credential to two fixed metadata reads and never exposes it to agents.",
  ),
  blocked(
    "onespan_sign_raw_bulk",
    "Use raw or bulk APIs",
    "Raw paths, arbitrary queries, pagination, polling, automatic retries, batch access, callbacks, webhooks, and exports are blocked.",
  ),
];

export const ONESPAN_SIGN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "onespan-sign",
  name: "OneSpan Sign",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.onespan.com/docs/oauth-20",
  providerWebsiteUrl: "https://www.onespan.com/products/onespan-sign",
  capabilities: [
    {
      ...capability(
        "transaction_list",
        "List transactions",
        "Read a bounded first page of privacy-redacted transaction lifecycle metadata.",
        true,
      ),
      platformCapability: "onespan_sign_transaction_list",
    },
    {
      ...capability(
        "transaction_get",
        "Inspect transaction metadata",
        "Read privacy-redacted lifecycle metadata for one explicit transaction.",
        true,
      ),
      platformCapability: "onespan_sign_transaction_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ONESPAN_SIGN_CLIENT_ID",
        label: "OneSpan Sign OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Customer-owned OAuth 2.0 client ID created by an authorized OneSpan Sign account administrator.",
      },
      {
        name: "ONESPAN_SIGN_CLIENT_SECRET",
        label: "OneSpan Sign OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Customer-owned client secret encrypted by Relay and exchanged only server-side.",
      },
      {
        name: "ONESPAN_SIGN_ENVIRONMENT",
        label: "OneSpan Sign environment",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use one documented environment key: us2-sandbox, us1-sandbox, us2-production, us1-production, eu-production, canada-sandbox, canada-production, or australia-production.",
      },
    ],
  },
  tools: [
    {
      name: "onespan_sign.listTransactions",
      functionName: "onespan_sign_transaction_list",
      aliases: ["onespan_sign_transaction_list"],
      capability: "transaction_list",
      platformCapability: "onespan_sign_transaction_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 first-page privacy-redacted transaction lifecycle summaries for one status.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: [
              "DRAFT",
              "SENT",
              "COMPLETED",
              "ARCHIVED",
              "DECLINED",
              "OPTED_OUT",
              "EXPIRED",
            ],
          },
          resultLimit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            default: 25,
          },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
    {
      name: "onespan_sign.getTransaction",
      functionName: "onespan_sign_transaction_get",
      aliases: ["onespan_sign_transaction_get"],
      capability: "transaction_get",
      platformCapability: "onespan_sign_transaction_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read privacy-redacted lifecycle metadata for one explicit transaction ID.",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: {
            type: "string",
            minLength: 1,
            maxLength: 128,
            pattern: "^[A-Za-z0-9_-]+={0,2}$",
          },
        },
        required: ["transactionId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "onespan_sign_read_only",
      label: "Read-only transaction lifecycle",
      description:
        "Two fixed privacy-redacted transaction metadata reads run automatically; OneSpan's currently unscoped account credential remains confined server-side.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Fixed environment, token exchange, paths, strict projection, result cap, and read-only boundary remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "client_credentials",
      label: "Customer-owned client credentials and bounded package read",
    },
  ],
};
