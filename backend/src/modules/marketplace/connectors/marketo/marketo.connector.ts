import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MARKETO_REQUIRED_PERMISSIONS = [
  "Read-Only Lead",
  "Read-Only Assets",
];

const reads = [
  action(
    "marketo_lead_summary_get",
    "Read selected lead summary",
    "Read identifiers and timestamps for one preselected lead without exposing personal or custom fields.",
  ),
  action(
    "marketo_program_summary_get",
    "Read selected program summary",
    "Read bounded organizational metadata for one preselected program.",
  ),
];

const guards = [
  blocked(
    "marketo_private_data",
    "Expose private marketing data",
    "Lead contact fields, activities, memberships, cookies, companies, opportunities, custom objects, tokens, secrets, raw responses, and unselected asset details are excluded.",
  ),
  blocked(
    "marketo_mutation",
    "Mutate Marketo state",
    "Lead sync, merges, associations, campaign requests, imports, activity creation, asset changes, approvals, administration, and user management are blocked.",
  ),
  blocked(
    "marketo_broad_access",
    "Use broad Marketo access",
    "Other subscriptions, API users, leads, programs, assets, workspaces, partitions, list or search endpoints, paging, bulk APIs, SOAP, arbitrary paths, redirects, downloads, and exports are blocked.",
  ),
];

export const MARKETO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "marketo",
  name: "Marketo",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/authentication",
  providerWebsiteUrl:
    "https://business.adobe.com/products/marketo/adobe-marketo.html",
  capabilities: [
    {
      ...capability(
        "marketo_lead_summary_get",
        "Read selected lead summary",
        "Read only the ID and timestamps for one selected lead.",
        true,
      ),
      platformCapability: "marketo_lead_summary_get",
    },
    {
      ...capability(
        "marketo_program_summary_get",
        "Read selected program summary",
        "Read bounded organizational metadata for one selected program.",
        true,
      ),
      platformCapability: "marketo_program_summary_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MARKETO_SUBSCRIPTION_ID",
        label: "Marketo subscription ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact Munchkin/account ID from the subscription REST and Identity endpoints.",
      },
      {
        name: "MARKETO_CLIENT_ID",
        label: "Marketo custom-service client ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A dedicated customer-owned custom service assigned only Read-Only Lead and Read-Only Assets.",
      },
      {
        name: "MARKETO_CLIENT_SECRET",
        label: "Marketo custom-service client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Relay encrypts this secret and sends it only to the selected subscription Identity endpoint.",
      },
      {
        name: "MARKETO_API_USER",
        label: "Expected API-only user",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact API-only user email that the Identity token scope must return.",
      },
      {
        name: "MARKETO_LEAD_ID",
        label: "Selected lead ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The one Marketo lead whose ID and timestamps Relay may read.",
      },
      {
        name: "MARKETO_PROGRAM_ID",
        label: "Selected program ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The one Marketo program whose bounded summary Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "marketo.getLeadSummary",
      functionName: "marketo_lead_summary_get",
      aliases: [
        "marketo.getLeadSummary",
        "marketo_lead_summary_get",
        "relay_marketo_get_lead_summary",
      ],
      capability: "marketo_lead_summary_get",
      platformCapability: "marketo_lead_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read the ID and timestamps for the preselected Marketo lead.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "marketo.getProgramSummary",
      functionName: "marketo_program_summary_get",
      aliases: [
        "marketo.getProgramSummary",
        "marketo_program_summary_get",
        "relay_marketo_get_program_summary",
      ],
      capability: "marketo_program_summary_get",
      platformCapability: "marketo_program_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded organizational metadata for the preselected Marketo program.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "marketo_read_only",
      label: "Read Only",
      description:
        "Read one selected lead and program through a dedicated two-permission API-only user; personal data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "marketo_no_access",
      label: "No Access",
      description: "Expose no Marketo actions.",
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
      id: "selected_program",
      label:
        "Marketo subscription, API-only user, read permissions, and selected program validation",
      requiredScopes: MARKETO_REQUIRED_PERMISSIONS,
    },
  ],
};
