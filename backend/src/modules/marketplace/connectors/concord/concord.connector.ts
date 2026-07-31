import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "concord_agreement_metadata_get",
    "Inspect agreement metadata",
    "Inspect redacted lifecycle metadata for one explicit agreement in the bound organization.",
  ),
];
const writes = [
  action(
    "concord_agreement_draft_create",
    "Create agreement draft",
    "Create one bounded unsent DRAFT agreement in the bound organization.",
  ),
];
const blockedActions = [
  blocked(
    "concord_private_contract_data",
    "Access private contract data",
    "Agreement content, descriptions in results, versions, fields, financial clauses, comments, activities, members, attachments, PDFs, DOCX files, signatures, approvals, links, and people are blocked.",
  ),
  blocked(
    "concord_external_actions",
    "Send or change external state",
    "Sharing, invitations, negotiation, approval actions, signing, signature requests, publishing, exports, webhooks, integrations, renewals, lifecycle changes, and deletion are blocked.",
  ),
  blocked(
    "concord_administration",
    "Administer Concord",
    "Organizations, users, roles, groups, folders, clauses, reports, branding, billing, subscriptions, API keys, and account administration are blocked.",
  ),
  blocked(
    "concord_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary queries or bodies, inbox searches, pagination, polling, retries, batches, downloads, exports, and provider-response pass-through are blocked.",
  ),
];

export const CONCORD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "concord",
  name: "Concord",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.doc.concordnow.com/",
  providerWebsiteUrl: "https://www.concord.app/",
  capabilities: [
    {
      ...capability(
        "agreement_metadata_read",
        "Inspect agreement metadata",
        "Read one agreement's redacted lifecycle metadata in the exact bound organization.",
        true,
      ),
      platformCapability: "concord_agreement_metadata_read",
    },
    {
      ...capability(
        "agreement_draft_create",
        "Create agreement drafts",
        "Create one bounded agreement with DRAFT status and no sending, sharing, signing, or automation.",
        true,
      ),
      platformCapability: "concord_agreement_draft_create",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CONCORD_API_ORIGIN",
        label: "Concord API environment",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use exactly https://api.concordnow.com for production or https://uat.concordnow.com for Concord UAT.",
      },
      {
        name: "CONCORD_ORGANIZATION_ID",
        label: "Concord organization ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Bind Relay to one exact customer organization ID.",
      },
      {
        name: "CONCORD_API_KEY",
        label: "Concord API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a dedicated customer-owned API key for the bound organization on an eligible paid plan.",
      },
    ],
  },
  tools: [
    {
      name: "concord.getAgreementMetadata",
      functionName: "concord_agreement_metadata_get",
      aliases: [
        "concord.getAgreementMetadata",
        "concord_agreement_metadata_get",
      ],
      capability: "agreement_metadata_read",
      platformCapability: "concord_agreement_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read redacted lifecycle metadata for one explicit Concord agreement UID.",
      inputSchema: {
        type: "object",
        properties: {
          agreementUid: {
            type: "string",
            minLength: 1,
            maxLength: 64,
            pattern: "^[A-Za-z0-9_-]+$",
          },
        },
        required: ["agreementUid"],
        additionalProperties: false,
      },
    },
    {
      name: "concord.createAgreementDraft",
      functionName: "concord_agreement_draft_create",
      aliases: [
        "concord.createAgreementDraft",
        "concord_agreement_draft_create",
      ],
      capability: "agreement_draft_create",
      platformCapability: "concord_agreement_draft_create",
      action: "write",
      approvalRequired: true,
      description:
        "Create one unsent Concord agreement draft in the bound organization.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 127 },
          description: { type: "string", minLength: 1, maxLength: 1024 },
          tags: {
            type: "array",
            maxItems: 20,
            uniqueItems: true,
            items: { type: "string", minLength: 1, maxLength: 100 },
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "concord_safe",
      label: "Safe",
      description:
        "Redacted metadata reads run automatically; creating a provider-hosted agreement draft requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected draft creation runs without Relay approval; exact environment and organization binding, key secrecy, fixed routes, DRAFT state, bounds, redaction, audits, provider roles, and plan limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "user_organization_binding",
      label: "Concord API key, environment, and current organization binding",
    },
  ],
};
