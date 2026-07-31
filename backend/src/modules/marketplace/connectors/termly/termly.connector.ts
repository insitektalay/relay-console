import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "termly_website_get",
    "Read selected website status",
    "Read one selected website's redacted compliance and scan-status summary.",
  ),
  action(
    "termly_banner_get",
    "Read selected banner status",
    "Read one selected website's bounded consent-banner configuration summary.",
  ),
];
const guards = [
  blocked(
    "termly_private_data",
    "Expose private compliance data",
    "Partner keys, WordPress API keys, company contacts, code snippets, consent records, visitor identifiers, cookie details, documents, and collaborator data are excluded.",
  ),
  blocked(
    "termly_mutation",
    "Mutate Termly configuration",
    "Website, banner, cookie, theme, document, scan, collaborator, and consent mutations are blocked.",
  ),
  blocked(
    "termly_broad_access",
    "Use broad Termly access",
    "Account-wide listing, other websites, paging, scrolling, arbitrary queries, raw paths, batch requests, redirects, and export are blocked.",
  ),
];

export const TERMLY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "termly",
  name: "Termly",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.termly.io/introduction/authentication/",
  providerWebsiteUrl: "https://termly.io/",
  capabilities: [
    {
      ...capability(
        "termly_website_get",
        "Read website status",
        "Read one selected website's redacted compliance and scan-status summary.",
        true,
      ),
      platformCapability: "termly_website_get",
    },
    {
      ...capability(
        "termly_banner_get",
        "Read banner status",
        "Read one selected website's bounded consent-banner configuration summary.",
        true,
      ),
      platformCapability: "termly_banner_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TERMLY_PUBLIC_KEY",
        label: "Termly partner public key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Termly manually issues this partner API public key. Relay encrypts it server-side.",
      },
      {
        name: "TERMLY_PRIVATE_KEY",
        label: "Termly partner private key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Termly manually issues this partner API private key. Relay encrypts it and uses it only for request signing.",
      },
      {
        name: "TERMLY_ACCOUNT_ID",
        label: "Termly account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The exact acct_ identifier allowed by the partner key.",
      },
      {
        name: "TERMLY_WEBSITE_ID",
        label: "Selected Termly website ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The one web_ website Relay may inspect.",
      },
    ],
  },
  tools: [
    {
      name: "termly.getWebsiteSummary",
      functionName: "termly_website_get",
      aliases: [
        "termly.getWebsiteSummary",
        "termly_website_get",
        "relay_termly_get_website_summary",
      ],
      capability: "termly_website_get",
      platformCapability: "termly_website_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read the redacted status summary for the selected Termly website.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "termly.getBannerSummary",
      functionName: "termly_banner_get",
      aliases: [
        "termly.getBannerSummary",
        "termly_banner_get",
        "relay_termly_get_banner_summary",
      ],
      capability: "termly_banner_get",
      platformCapability: "termly_banner_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read the bounded consent-banner configuration for the selected Termly website.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "termly_read_only",
      label: "Read Only",
      description:
        "Read status for one selected website and its banner; private data and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "termly_no_access",
      label: "No Access",
      description: "Expose no Termly actions.",
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
      id: "selected_website",
      label: "Termly partner key and selected website validation",
    },
  ],
};
