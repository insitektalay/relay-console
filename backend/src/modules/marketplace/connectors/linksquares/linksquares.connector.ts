import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "linksquares_agreement_types_list",
    "List agreement types",
    "List at most 100 strictly projected Analyze agreement-type IDs and names.",
  ),
];
const blockedActions = [
  blocked(
    "linksquares_agreement_data",
    "Access agreement data",
    "Agreement names, metadata, Smart Values, terms, tags, notes, hierarchy, content, attachments, versions, files, download links, and presigned URLs are blocked.",
  ),
  blocked(
    "linksquares_finalize_people",
    "Access Finalize or people data",
    "Finalize templates, questions, tokens, agreements, tasks, activity, comments, users, roles, emails, departments, and job titles are blocked.",
  ),
  blocked(
    "linksquares_mutation_admin",
    "Mutate or administer LinkSquares",
    "Agreement imports, creates, updates, links, approvals, uploads, status changes, notes, tags, API-key management, service accounts, settings, and administration are blocked.",
  ),
  blocked(
    "linksquares_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary queries, filters, sync, cursors, pagination, polling, retries, batches, exports, downloads, and provider-response pass-through are blocked.",
  ),
];

export const LINKSQUARES_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "linksquares",
  name: "LinkSquares",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.linksquares.com/hc/en-us/articles/10575707057175-LinkSquares-API-Overview",
  providerWebsiteUrl: "https://linksquares.com/",
  capabilities: [
    {
      ...capability(
        "agreement_type_metadata_list",
        "List agreement types",
        "List bounded Analyze agreement-type IDs and names without agreements, terms, tags, files, or people.",
        true,
      ),
      platformCapability: "linksquares_agreement_type_metadata_list",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LINKSQUARES_API_KEY",
        label: "LinkSquares API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned service-account key from an API-enabled LinkSquares account and store it only through Relay's encrypted connection flow.",
      },
    ],
  },
  tools: [
    {
      name: "linksquares.listAgreementTypes",
      functionName: "linksquares_agreement_types_list",
      aliases: [
        "linksquares.listAgreementTypes",
        "linksquares_agreement_types_list",
      ],
      capability: "agreement_type_metadata_list",
      platformCapability: "linksquares_agreement_type_metadata_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 100 strictly projected LinkSquares Analyze agreement-type IDs and names.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 100 } },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "linksquares_type_read_only",
      label: "Read-only agreement-type metadata",
      description:
        "One fixed privacy-redacted Analyze agreement-type read runs automatically through a customer-owned broad administrator key.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Customer ownership, fixed origin and route, key secrecy, strict projection, result bounds, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "analyze_me_status",
      label: "LinkSquares API key and Analyze service status",
    },
  ],
};
