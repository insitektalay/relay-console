import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const resultRead = action(
  "snov_email_verification_result_get",
  "Read one verification result",
  "Read reduced technical status for one exact Snov.io task hash without returning the submitted email.",
);
const verificationStart = action(
  "snov_email_verification_start",
  "Start one email verification",
  "Spend one Snov.io credit to submit one explicit email for verification without a webhook or bulk request.",
);
const blocks = [
  blocked(
    "snov_discovery_finder_enrichment",
    "Block discovery and enrichment",
    "Domain Search, Email Finder, company/person/LinkedIn enrichment, prospect discovery, sources, exports and bulk contact data are unavailable.",
  ),
  blocked(
    "snov_prospects_campaigns_messages",
    "Block prospects and outreach",
    "Prospects, lists, do-not-email mutations, campaigns, sequences, recipients, content, sending, replies, opens, clicks and LinkedIn automation are unavailable.",
  ),
  blocked(
    "snov_mailboxes_warmup_crm_admin_raw",
    "Block connected resources and raw access",
    "Email accounts, SMTP/IMAP credentials, warm-up, deliverability, CRM, webhooks, team/admin, arbitrary API, browser sessions, bulk, retries and pagination are unavailable.",
  ),
];

export const SNOV_IO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "snov-io",
  name: "Snov.io",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://snov.io/api",
  providerWebsiteUrl: "https://snov.io/",
  capabilities: [
    {
      ...capability(
        "email_verification_start",
        "Start one email verification",
        "Submit one explicit email to Snov.io under credit-aware policy and receive only a task hash.",
        true,
      ),
      platformCapability: "email_verification_start",
    },
    {
      ...capability(
        "email_verification_result_read",
        "Read one verification result",
        "Read one task's reduced deliverability result without returning the submitted email.",
        true,
      ),
      platformCapability: "email_verification_result_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SNOV_CLIENT_ID",
        label: "Snov.io API User ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the API User ID from the Snov.io API settings for a dedicated customer-owned integration.",
      },
      {
        name: "SNOV_CLIENT_SECRET",
        label: "Snov.io API Secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Relay encrypts the API Secret and exchanges it server-side for one-hour bearer tokens. Rotate it in Snov.io after disconnect.",
      },
    ],
  },
  tools: [
    {
      name: "relay_snov_start_email_verification",
      functionName: "relay_snov_start_email_verification",
      aliases: ["snov_email_verification_start"],
      capability: "email_verification_start",
      platformCapability: "email_verification_start",
      action: "read",
      approvalRequired: true,
      description:
        "Spend one Snov.io credit to start verification for one explicit email and return only a task hash.",
      inputSchema: {
        type: "object",
        properties: { email: { type: "string", minLength: 3, maxLength: 254 } },
        required: ["email"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_snov_get_email_verification_result",
      functionName: "relay_snov_get_email_verification_result",
      aliases: ["snov_email_verification_result_get"],
      capability: "email_verification_result_read",
      platformCapability: "email_verification_result_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read reduced status and technical checks for one exact Snov.io verification task.",
      inputSchema: {
        type: "object",
        properties: {
          taskHash: {
            type: "string",
            minLength: 16,
            maxLength: 128,
            pattern: "^[A-Za-z0-9_-]+$",
          },
        },
        required: ["taskHash"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "snov_safe",
      label: "Safe",
      description:
        "Result reads run automatically; each one-credit email-verification start requires approval. Discovery, enrichment, outreach, connected resources, administration, bulk and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [resultRead],
      approvalRequiredActions: [verificationStart],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both bounded actions run without Relay per-action approval; credit charging, one-email bounds, legal/privacy handling, provider limits and output reduction still apply.",
      defaultSelected: false,
      allowedActions: [verificationStart, resultRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "customer_client_credentials",
      label: "Customer-owned Snov.io API User ID and API Secret",
    },
  ],
};
