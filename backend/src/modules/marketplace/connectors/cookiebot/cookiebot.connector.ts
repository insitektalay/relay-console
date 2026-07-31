import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "cookiebot_consent_stats_get",
    "Read recent consent totals",
    "Read a fixed seven-day aggregate for one selected Cookiebot domain without country or visitor data.",
  ),
  action(
    "cookiebot_cookie_scan_summary_get",
    "Read cookie scan totals",
    "Read aggregate cookie-scan counts for one selected domain without cookie names, values, providers, URLs, IPs, or source code.",
  ),
];
const guards = [
  blocked(
    "cookiebot_private_data",
    "Expose private consent or cookie data",
    "API keys, consent IDs, visitor data, country breakdowns, cookie names, values, providers, paths, URLs, IPs, and source code are excluded.",
  ),
  blocked(
    "cookiebot_mutation",
    "Mutate Cookiebot state",
    "Banner actions, consent submission, withdrawal, renewal, settings, domains, scans, scripts, and consent logs are blocked.",
  ),
  blocked(
    "cookiebot_broad_access",
    "Use broad Cookiebot access",
    "Other domain groups or domains, custom ranges, domain paths, raw endpoints, redirects, bulk export, and browser SDK execution are blocked.",
  ),
];

export const COOKIEBOT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cookiebot",
  name: "Cookiebot",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.cookiebot.com/hc/en-us/sections/360001333773-Cookiebot-API",
  providerWebsiteUrl: "https://www.cookiebot.com/",
  capabilities: [
    {
      ...capability(
        "cookiebot_consent_stats_get",
        "Read recent consent totals",
        "Read one domain's fixed seven-day consent aggregate without country or visitor data.",
        true,
      ),
      platformCapability: "cookiebot_consent_stats_get",
    },
    {
      ...capability(
        "cookiebot_cookie_scan_summary_get",
        "Read cookie scan totals",
        "Read one domain's aggregate cookie-scan counts without detailed tracker data.",
        true,
      ),
      platformCapability: "cookiebot_cookie_scan_summary_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "COOKIEBOT_API_KEY",
        label: "Cookiebot secret API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The account API key from Cookiebot Manager. Relay encrypts it and uses it only in fixed data-API paths.",
      },
      {
        name: "COOKIEBOT_DOMAIN_GROUP_ID",
        label: "Cookiebot Domain Group ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The exact UUID-form CBID/Domain Group ID Relay may inspect.",
      },
      {
        name: "COOKIEBOT_DOMAIN",
        label: "Selected Cookiebot domain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The one registered hostname Relay may inspect.",
      },
    ],
  },
  tools: [
    {
      name: "cookiebot.getRecentConsentSummary",
      functionName: "cookiebot_consent_stats_get",
      aliases: [
        "cookiebot.getRecentConsentSummary",
        "cookiebot_consent_stats_get",
        "relay_cookiebot_get_recent_consent_summary",
      ],
      capability: "cookiebot_consent_stats_get",
      platformCapability: "cookiebot_consent_stats_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read a fixed seven-day redacted consent aggregate for the selected domain.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "cookiebot.getCookieScanSummary",
      functionName: "cookiebot_cookie_scan_summary_get",
      aliases: [
        "cookiebot.getCookieScanSummary",
        "cookiebot_cookie_scan_summary_get",
        "relay_cookiebot_get_cookie_scan_summary",
      ],
      capability: "cookiebot_cookie_scan_summary_get",
      platformCapability: "cookiebot_cookie_scan_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read redacted aggregate cookie-scan counts for the selected domain.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "cookiebot_read_only",
      label: "Read Only",
      description:
        "Read two redacted aggregates for one selected domain; detailed data and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "cookiebot_no_access",
      label: "No Access",
      description: "Expose no Cookiebot actions.",
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
      id: "selected_domain",
      label: "Cookiebot API key and selected domain validation",
    },
  ],
};
