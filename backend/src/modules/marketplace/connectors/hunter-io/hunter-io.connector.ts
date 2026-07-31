import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const automaticReads = [
  action(
    "hunter_account_usage_get",
    "Read account usage",
    "Read only plan and current-period credit/search/verification usage through Hunter's free account endpoint.",
  ),
  action(
    "hunter_domain_email_count_get",
    "Read domain email counts",
    "Read only aggregate total, personal and generic email counts for one validated domain through Hunter's free count endpoint.",
  ),
];
const verification = action(
  "hunter_email_verify",
  "Verify one email address",
  "Spend up to 0.5 Hunter credit to verify one explicitly supplied email, returning only deliverability status, score and technical check flags.",
);
const blocks = [
  blocked(
    "hunter_discovery_finding_enrichment",
    "Block contact discovery and enrichment",
    "Discover, Domain Search, Domain Finder, Email Finder, people/company/combined enrichment, sources, names, titles, locations, social profiles, phone numbers and contact exports are unavailable.",
  ),
  blocked(
    "hunter_leads_companies_sequences_messages",
    "Block outreach and resource management",
    "Leads, companies, lists, tags, custom attributes, sequences, templates, recipients, email accounts, messages, sending, webhooks, connected apps and all writes or deletes are unavailable.",
  ),
  blocked(
    "hunter_admin_bulk_raw",
    "Block administration, bulk and raw access",
    "Team members, usage history, API-key administration, bulk operations, arbitrary paths or parameters, raw API/MCP, browser sessions, pagination, retries, redirects and webhooks are unavailable.",
  ),
];

export const HUNTER_IO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hunter-io",
  name: "Hunter.io",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://hunter.io/api-documentation/v2",
  providerWebsiteUrl: "https://hunter.io/",
  capabilities: [
    {
      ...capability(
        "account_usage_read",
        "Read account usage",
        "Read only bounded current-period Hunter plan and request usage without identity or team data.",
        true,
      ),
      platformCapability: "account_usage_read",
    },
    {
      ...capability(
        "domain_email_count_read",
        "Read domain email counts",
        "Read only aggregate email counts for one validated domain without revealing contacts.",
        true,
      ),
      platformCapability: "domain_email_count_read",
    },
    {
      ...capability(
        "email_verification",
        "Verify one email",
        "Spend Hunter verification credit for one explicit email and return only reduced technical deliverability state.",
        true,
      ),
      platformCapability: "email_verification",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HUNTER_API_KEY",
        label: "Customer-owned Hunter API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated Hunter API key. Relay sends it only in X-API-KEY, encrypts its copy, and requires you to delete the key in Hunter after disconnect.",
      },
    ],
  },
  tools: [
    {
      name: "relay_hunter_get_account_usage",
      functionName: "relay_hunter_get_account_usage",
      aliases: ["hunter_account_usage_get"],
      capability: "account_usage_read",
      platformCapability: "account_usage_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded plan and current-period request usage without identity or team data.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_hunter_get_domain_email_count",
      functionName: "relay_hunter_get_domain_email_count",
      aliases: ["hunter_domain_email_count_get"],
      capability: "domain_email_count_read",
      platformCapability: "domain_email_count_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read aggregate email counts for one validated domain without revealing contacts.",
      inputSchema: {
        type: "object",
        properties: {
          domain: {
            type: "string",
            minLength: 3,
            maxLength: 253,
            pattern: "^[A-Za-z0-9.-]+$",
          },
        },
        required: ["domain"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_hunter_verify_email",
      functionName: "relay_hunter_verify_email",
      aliases: ["hunter_email_verify"],
      capability: "email_verification",
      platformCapability: "email_verification",
      action: "read",
      approvalRequired: true,
      description:
        "Spend Hunter verification credit for one explicit email and return only reduced deliverability state.",
      inputSchema: {
        type: "object",
        properties: { email: { type: "string", minLength: 3, maxLength: 254 } },
        required: ["email"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "hunter_safe",
      label: "Safe",
      description:
        "Free usage and aggregate domain-count reads run automatically; each credit-consuming email verification requires approval. Contact discovery, enrichment, outreach, administration, bulk and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: automaticReads,
      approvalRequiredActions: [verification],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three bounded reads, including single-email verification, run without Relay per-action approval; Hunter credits, legal/privacy denials, input bounds, reduction and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...automaticReads, verification],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "customer_api_key",
      label: "Dedicated customer-owned Hunter API key",
    },
  ],
};
