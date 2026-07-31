import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "benchmark_email_contact_summary_get",
    "Read selected contact summary",
    "Read only the ID and timestamps for one preselected Benchmark Email contact.",
  ),
  action(
    "benchmark_email_campaign_summary_get",
    "Read selected campaign summary",
    "Read bounded lifecycle metadata for one preselected Benchmark Email campaign.",
  ),
];

const guards = [
  blocked(
    "benchmark_email_private_data",
    "Expose private marketing data",
    "Contact keys, fields, status, lists, and events plus campaign preview, failure detail, counts, content, sender, audience, reports, and links are excluded.",
  ),
  blocked(
    "benchmark_email_mutation",
    "Mutate Benchmark Email state",
    "Contacts, lists, fields, campaigns, templates, sends, domains, and every other mutation are blocked.",
  ),
  blocked(
    "benchmark_email_broad_access",
    "Use broad Benchmark Email access",
    "Other contacts, campaigns, lists, templates, reports, domains, arbitrary origins, paths, queries, redirects, downloads, and exports are blocked.",
  ),
];

export const BENCHMARK_EMAIL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "benchmark-email",
    name: "Benchmark Email",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developers.benchmarkemail.io/",
    providerWebsiteUrl: "https://www.benchmarkemail.com/",
    capabilities: [
      {
        ...capability(
          "benchmark_email_contact_summary_get",
          "Read selected contact summary",
          "Read only the ID and timestamps for one selected contact.",
          true,
        ),
        platformCapability: "benchmark_email_contact_summary_get",
      },
      {
        ...capability(
          "benchmark_email_campaign_summary_get",
          "Read selected campaign summary",
          "Read bounded lifecycle metadata for one selected campaign.",
          true,
        ),
        platformCapability: "benchmark_email_campaign_summary_get",
      },
    ],
    auth: {
      type: "custom",
      credentialSchema: [
        {
          name: "BENCHMARK_EMAIL_API_KEY",
          label: "Benchmark Email API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "A dedicated customer-generated key with only contacts:read and campaigns:read; Relay encrypts it and sends it only in X-API-Key.",
        },
        {
          name: "BENCHMARK_EMAIL_API_BASE_URL",
          label: "Benchmark Email regional API base URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact regional API origin shown beside the key; Relay accepts only documented api-*.benchmarkemail.io HTTPS origins.",
        },
        {
          name: "BENCHMARK_EMAIL_CONTACT_ID",
          label: "Selected non-email contact ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact contact ID whose ID and timestamps Relay may read; email selectors are rejected.",
        },
        {
          name: "BENCHMARK_EMAIL_CAMPAIGN_ID",
          label: "Selected campaign ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact campaign whose bounded lifecycle metadata Relay may read.",
        },
      ],
    },
    tools: [
      {
        name: "benchmarkEmail.getContactSummary",
        functionName: "benchmark_email_contact_summary_get",
        aliases: [
          "benchmarkEmail.getContactSummary",
          "benchmark_email_contact_summary_get",
          "relay_benchmark_email_get_contact_summary",
        ],
        capability: "benchmark_email_contact_summary_get",
        platformCapability: "benchmark_email_contact_summary_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read only the ID and timestamps for the selected contact.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "benchmarkEmail.getCampaignSummary",
        functionName: "benchmark_email_campaign_summary_get",
        aliases: [
          "benchmarkEmail.getCampaignSummary",
          "benchmark_email_campaign_summary_get",
          "relay_benchmark_email_get_campaign_summary",
        ],
        capability: "benchmark_email_campaign_summary_get",
        platformCapability: "benchmark_email_campaign_summary_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded lifecycle metadata for the selected campaign.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "benchmark_email_read_only",
        label: "Read Only",
        description:
          "Read one selected contact and campaign through an encrypted two-scope API key; private data, broader access, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "benchmark_email_no_access",
        label: "No Access",
        description: "Expose no Benchmark Email actions.",
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
      {
        id: "selected_campaign",
        label:
          "Benchmark Email API key, regional origin, and campaign validation",
        requiredScopes: ["contacts:read", "campaigns:read"],
      },
    ],
  };
