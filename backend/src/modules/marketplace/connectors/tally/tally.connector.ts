import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "tally_form_list",
    "List forms",
    "Read page one of twenty-five token-visible Form metadata summaries.",
  ),
  action(
    "tally_form_get",
    "Read form metadata",
    "Read one exact Form metadata summary without blocks, settings, or payments.",
  ),
  action(
    "tally_submission_list",
    "List submission metadata",
    "Read page one of twenty-five completed Submission lifecycle summaries without questions or responses.",
  ),
];

const blockedActions = [
  blocked(
    "tally_private_content",
    "Read private form content",
    "Questions, answers, respondent identity, sessions, files, PDFs, previews, payments, settings, blocks, analytics, members, and invites are outside V1.",
  ),
  blocked(
    "tally_form_mutation",
    "Change forms",
    "Creating, publishing, updating, duplicating, moving, closing, or deleting Forms is outside V1.",
  ),
  blocked(
    "tally_submission_mutation",
    "Change submissions",
    "Creating, updating, or deleting Submissions is outside V1.",
  ),
  blocked(
    "tally_administration",
    "Administer Tally",
    "Workspace, organization, user, invite, webhook, and webhook-event administration is outside V1.",
  ),
  blocked(
    "tally_raw_export",
    "Run raw requests or exports",
    "Raw API or MCP tools, arbitrary pages, limits, filters, dates, searches, pagination, crawling, synchronization, and export are outside V1.",
  ),
];

const formId = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9_-]+$",
};

export const TALLY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "tally",
  name: "Tally",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.tally.so/api-reference/introduction",
  providerWebsiteUrl: "https://tally.so/",
  capabilities: [
    {
      ...capability(
        "form_list",
        "List forms",
        "Read a bounded page of token-visible Form metadata summaries.",
        true,
      ),
      platformCapability: "tally_form_read",
    },
    {
      ...capability(
        "form_get",
        "Read form metadata",
        "Read one exact Form metadata summary.",
        true,
      ),
      platformCapability: "tally_form_read",
    },
    {
      ...capability(
        "submission_list",
        "List submission metadata",
        "Read a bounded page of completed Submission lifecycle summaries.",
        true,
      ),
      platformCapability: "tally_submission_metadata_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TALLY_API_KEY",
        label: "Tally API key",
        secret: true,
        required: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated user-bound API key in Tally Settings. The key inherits that user's changing permissions and can access all resources visible to that user.",
      },
    ],
  },
  tools: [
    {
      name: "tally.listForms",
      functionName: "tally_form_list",
      aliases: ["tally.listForms", "tally_form_list"],
      capability: "form_list",
      platformCapability: "tally_form_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five token-visible Form metadata summaries.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "tally.getForm",
      functionName: "tally_form_get",
      aliases: ["tally.getForm", "tally_form_get"],
      capability: "form_get",
      platformCapability: "tally_form_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact Form metadata summary without blocks, settings, or payments.",
      inputSchema: {
        type: "object",
        properties: { formId },
        required: ["formId"],
        additionalProperties: false,
      },
    },
    {
      name: "tally.listSubmissions",
      functionName: "tally_submission_list",
      aliases: ["tally.listSubmissions", "tally_submission_list"],
      capability: "submission_list",
      platformCapability: "tally_submission_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five completed Submission lifecycle summaries without questions or responses.",
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
      id: "tally_safe",
      label: "Safe",
      description:
        "Three bounded metadata-only reads run automatically; private content, administration, arbitrary requests, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact current-user health, Tally-granted permissions, the fixed origin and API version, limits, audit, redaction, and provider rate limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label: "Tally API-key and exact current-user validation",
      requiredScopes: [],
    },
  ],
};
