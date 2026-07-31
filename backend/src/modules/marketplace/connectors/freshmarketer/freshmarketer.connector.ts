import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "freshmarketer_filter_list",
    "List contact views",
    "List bounded Freshmarketer contact-view identifiers and names.",
  ),
  action(
    "freshmarketer_contact_metadata_list",
    "List contact metadata",
    "List one fixed first page of contact operational metadata without identity or contact details.",
  ),
];
const fullApi = [
  action(
    "freshmarketer_full_api",
    "Use Freshworks CRM API",
    "Use a documented Freshworks CRM API operation authorized by the connected Freshmarketer user key; Safe mode requires approval.",
  ),
];

export const FRESHMARKETER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "freshmarketer",
  name: "Freshmarketer",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.freshworks.com/crm/api/",
  providerWebsiteUrl: "https://www.freshworks.com/crm/marketing/",
  capabilities: [
    {
      ...capability(
        "contact_metadata_read",
        "Read contact operations",
        "List contact views and bounded operational metadata without names, email or phone, addresses, custom fields, accounts, owners, activities, notes, or message content.",
        true,
      ),
      platformCapability: "freshmarketer_contact_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Freshworks CRM API",
        "Use documented CRM API operations allowed by the connected Freshmarketer user API key.",
        true,
      ),
      platformCapability: "freshmarketer_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FRESHMARKETER_BUNDLE_URL",
        label: "Freshmarketer CRM bundle URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the exact HTTPS Freshworks CRM bundle base from API Settings, including its /crm/... bundle alias and excluding /api.",
      },
      {
        name: "FRESHMARKETER_API_KEY",
        label: "Freshmarketer API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy your user API key from Freshworks CRM profile API Settings. Its access follows your role and scopes.",
      },
    ],
  },
  tools: [
    {
      name: "freshmarketer.listContactFilters",
      functionName: "freshmarketer_filter_list",
      aliases: [
        "freshmarketer.listContactFilters",
        "freshmarketer_filter_list",
      ],
      capability: "contact_metadata_read",
      platformCapability: "freshmarketer_contact_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most one hundred contact-view IDs and names without contact records.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "freshmarketer.listContactMetadata",
      functionName: "freshmarketer_contact_metadata_list",
      aliases: [
        "freshmarketer.listContactMetadata",
        "freshmarketer_contact_metadata_list",
      ],
      capability: "contact_metadata_read",
      platformCapability: "freshmarketer_contact_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five first-page contact IDs, marketing/subscription state, score, contact mode, and timestamps without identity, contact details, embeds, or custom fields.",
      inputSchema: {
        type: "object",
        properties: {
          viewId: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["viewId"],
        additionalProperties: false,
      },
    },
    {
      name: "freshmarketer.request",
      functionName: "freshmarketer_request",
      aliases: [
        "freshmarketer.request",
        "freshmarketer_request",
        "freshmarketer_full_api",
      ],
      capability: "full_api",
      platformCapability: "freshmarketer_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Freshworks CRM API method and relative /api path on the fixed bundle URL. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: { type: "string", pattern: "^/api/" },
          query: { type: "object" },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "freshmarketer_safe",
      label: "Safe",
      description:
        "Identity-free contact metadata reads and every broader CRM API operation require approval; bundle binding, secret isolation, provider authorization, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected API-key-authorized operations run without Relay per-action approval; exact bundle binding, secret isolation, bounds, audits, provider authorization, and Freshworks limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "contact_filters",
      label:
        "Freshmarketer bundle URL, API key, role, and contact-filter check",
    },
  ],
};
