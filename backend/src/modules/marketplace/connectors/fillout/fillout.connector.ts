import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "fillout_form_list",
    "List forms",
    "Read at most twenty-five token-visible Form ID and name summaries.",
  ),
  action(
    "fillout_form_get_metadata_summary",
    "Read form metadata",
    "Read one exact Form ID, name, structural category counts, and quiz-enabled flag.",
  ),
  action(
    "fillout_submission_list_recent",
    "List recent submission metadata",
    "Read at most twenty-five recent finished Submission lifecycle summaries without response content.",
  ),
];

const blockedActions = [
  blocked(
    "fillout_submission_content",
    "Read submission content",
    "Questions, answers, calculations, respondent and login identity, scheduling, payments, files, edit links, previews, and private values are outside V1.",
  ),
  blocked(
    "fillout_submission_mutation",
    "Change submissions",
    "Creating, importing, updating, or deleting Fillout submissions is outside V1.",
  ),
  blocked(
    "fillout_webhook_mutation",
    "Change webhooks",
    "Creating or removing Fillout webhook subscriptions is outside V1.",
  ),
  blocked(
    "fillout_raw_query",
    "Run arbitrary requests",
    "Arbitrary paths, filters, dates, statuses, pages, searches, origins, and raw API access are outside V1.",
  ),
  blocked(
    "fillout_bulk_export",
    "Export Fillout data",
    "Automatic pagination, crawling, Zite or database APIs, synchronization, and export are outside V1.",
  ),
];

const formId = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9_-]+$",
};

export const FILLOUT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "fillout",
  name: "Fillout",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.fillout.com/help/fillout-rest-api",
  providerWebsiteUrl: "https://www.fillout.com/",
  capabilities: [
    {
      ...capability(
        "form_list",
        "List forms",
        "Read bounded token-visible Form ID and name summaries.",
        true,
      ),
      platformCapability: "fillout_form_read",
    },
    {
      ...capability(
        "form_metadata",
        "Read form metadata",
        "Read one exact Form metadata count summary.",
        true,
      ),
      platformCapability: "fillout_form_read",
    },
    {
      ...capability(
        "submission_list",
        "List submission metadata",
        "Read bounded finished Submission lifecycle summaries without response content.",
        true,
      ),
      platformCapability: "fillout_submission_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://build.fillout.com/authorize/oauth",
      tokenUrl: "https://server.fillout.com/public/oauth/accessToken",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "fillout.listForms",
      functionName: "fillout_form_list",
      aliases: ["fillout.listForms", "fillout_form_list"],
      capability: "form_list",
      platformCapability: "fillout_form_read",
      action: "read",
      approvalRequired: false,
      description: "Read at most twenty-five Form ID and name summaries.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "fillout.getFormMetadata",
      functionName: "fillout_form_get_metadata_summary",
      aliases: ["fillout.getFormMetadata", "fillout_form_get_metadata_summary"],
      capability: "form_metadata",
      platformCapability: "fillout_form_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact Form ID, name, structural category counts, and quiz-enabled flag.",
      inputSchema: {
        type: "object",
        properties: { formId },
        required: ["formId"],
        additionalProperties: false,
      },
    },
    {
      name: "fillout.listRecentSubmissions",
      functionName: "fillout_submission_list_recent",
      aliases: [
        "fillout.listRecentSubmissions",
        "fillout_submission_list_recent",
      ],
      capability: "submission_list",
      platformCapability: "fillout_submission_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most twenty-five recent finished Submission lifecycle summaries without response content.",
      inputSchema: {
        type: "object",
        properties: { formId },
        required: ["formId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "fillout_safe",
      label: "Safe",
      description:
        "Three bounded metadata-only reads run automatically; submission content, arbitrary queries, exports, webhooks, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while token authority, official origin binding, fixed requests, limits, audit, redaction, invalidation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "forms",
      label:
        "Fillout authorization, provider-returned API origin, and token-visible Form validation",
      requiredScopes: [],
    },
  ],
};
