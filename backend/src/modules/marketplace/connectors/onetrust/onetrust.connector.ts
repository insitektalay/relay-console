import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "onetrust_domain_branding_summary_get",
    "Read domain branding availability",
    "Confirm the branding-attributes resource is available for one selected OneTrust CMP domain without exposing its content.",
  ),
  action(
    "onetrust_scan_summary_get",
    "Read selected scan summary",
    "Read aggregate cookies, tags, forms, and lifecycle counts for one selected domain scan.",
  ),
];
const guards = [
  blocked(
    "onetrust_private_data",
    "Expose private trust data",
    "Client secrets, tokens, data subjects, identifiers, consent records, preferences, cookie details, scripts, HTML/CSS, vendors, forms, tags, credentials, and attachments are excluded.",
  ),
  blocked(
    "onetrust_mutation",
    "Mutate OneTrust state",
    "Publishing, scanning, categorization, domains, banners, preferences, consent, organizations, users, risk, governance, exports, and administration are blocked.",
  ),
  blocked(
    "onetrust_broad_access",
    "Use broad OneTrust access",
    "Other tenants, domains, scans, child organizations, list endpoints, paging, arbitrary queries, raw APIs, redirects, downloads, and bulk export are blocked.",
  ),
];

export const ONETRUST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "onetrust",
  name: "OneTrust",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.onetrust.com/onetrust/reference/quick-start-guide",
  providerWebsiteUrl: "https://www.onetrust.com/",
  capabilities: [
    {
      ...capability(
        "onetrust_domain_branding_summary_get",
        "Read domain branding availability",
        "Confirm branding attributes are available for one selected CMP domain without exposing their content.",
        true,
      ),
      platformCapability: "onetrust_domain_branding_summary_get",
    },
    {
      ...capability(
        "onetrust_scan_summary_get",
        "Read scan summary",
        "Read aggregate lifecycle and finding counts for one selected domain scan.",
        true,
      ),
      platformCapability: "onetrust_scan_summary_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ONETRUST_TENANT_HOST",
        label: "OneTrust tenant hostname",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact tenant hostname ending in onetrust.com, without scheme or path.",
      },
      {
        name: "ONETRUST_CLIENT_ID",
        label: "OneTrust client ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A customer-owned client credential limited to the required read scopes.",
      },
      {
        name: "ONETRUST_CLIENT_SECRET",
        label: "OneTrust client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Relay encrypts this secret and exchanges it server-side for short-lived access tokens.",
      },
      {
        name: "ONETRUST_DOMAIN_ID",
        label: "Selected OneTrust domain ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The one UUID-form CMP domain Relay may inspect.",
      },
      {
        name: "ONETRUST_SCAN_ID",
        label: "Selected OneTrust scan ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The one UUID-form scan summary Relay may inspect.",
      },
    ],
  },
  tools: [
    {
      name: "onetrust.getDomainBrandingSummary",
      functionName: "onetrust_domain_branding_summary_get",
      aliases: [
        "onetrust.getDomainBrandingSummary",
        "onetrust_domain_branding_summary_get",
        "relay_onetrust_get_domain_branding_summary",
      ],
      capability: "onetrust_domain_branding_summary_get",
      platformCapability: "onetrust_domain_branding_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Confirm branding attributes are available for the selected OneTrust CMP domain without exposing their content.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "onetrust.getScanSummary",
      functionName: "onetrust_scan_summary_get",
      aliases: [
        "onetrust.getScanSummary",
        "onetrust_scan_summary_get",
        "relay_onetrust_get_scan_summary",
      ],
      capability: "onetrust_scan_summary_get",
      platformCapability: "onetrust_scan_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read aggregate finding counts and lifecycle metadata for the selected domain scan.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "onetrust_read_only",
      label: "Read Only",
      description:
        "Read two selected-domain metadata summaries; private data and all mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "onetrust_no_access",
      label: "No Access",
      description: "Expose no OneTrust actions.",
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
      label: "OneTrust credentials and selected domain validation",
    },
  ],
};
