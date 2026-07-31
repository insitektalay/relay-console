import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
export const GOOGLE_FORMS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
];
const reads = [
  action(
    "google_forms_form_get",
    "Read form structure",
    "Read bounded structure from one app-visible Form without responses.",
  ),
  action(
    "google_forms_update_prepare",
    "Prepare form update",
    "Validate and hash one form or question creation locally.",
  ),
];
const writes = [
  action(
    "google_forms_form_create",
    "Create unpublished form",
    "Create one unpublished Form.",
  ),
  action(
    "google_forms_question_create",
    "Create form question",
    "Create one typed text or choice question.",
  ),
];
const blockedActions = [
  blocked(
    "google_forms_responses",
    "Read form responses",
    "Responses, identities, answers, grades, and uploaded files are blocked in V1.",
  ),
  blocked(
    "google_forms_watches_publish",
    "Watch or publish forms",
    "Response watches, publishing, accepting-response state, and responder management are blocked in V1.",
  ),
  blocked(
    "google_forms_settings",
    "Change quiz, grading, or collection settings",
    "Quiz, grading, answer keys, email collection, and settings are blocked in V1.",
  ),
  blocked(
    "google_forms_destructive",
    "Run destructive or arbitrary updates",
    "Delete, move, reorder, broad updates, media, file uploads, and arbitrary batches are blocked in V1.",
  ),
  blocked(
    "google_forms_external_raw",
    "Share, export, link data, or run raw operations",
    "Linked Sheets, sharing, export, domain delegation, and raw API or MCP access are blocked in V1.",
  ),
];
const id = {
  type: "string",
  minLength: 1,
  maxLength: 200,
  pattern: "^[A-Za-z0-9_:-]+$",
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 },
  idempotencyKey = { type: "string", minLength: 8, maxLength: 200 };
export const GOOGLE_FORMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-forms",
  name: "Google Forms",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.google.com/workspace/forms/api/guides/authorizing",
  providerWebsiteUrl: "https://workspace.google.com/products/forms/",
  capabilities: [
    {
      ...capability(
        "form_read",
        "Read form structure",
        "Read bounded questions and metadata without responses.",
        true,
      ),
      platformCapability: "google_forms_form_read",
    },
    {
      ...capability(
        "form_draft",
        "Prepare form updates",
        "Validate and hash typed form updates locally.",
        true,
      ),
      platformCapability: "google_forms_form_draft",
    },
    {
      ...capability(
        "form_write",
        "Create forms and questions",
        "Create unpublished Forms and typed questions after policy checks.",
        true,
      ),
      platformCapability: "google_forms_form_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_FORMS_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "googleForms.getForm",
      functionName: "google_forms_form_get",
      aliases: ["google_forms_form_get"],
      capability: "form_read",
      platformCapability: "google_forms_form_read",
      action: "read",
      approvalRequired: false,
      description: "Read at most 100 structural items without responses.",
      inputSchema: {
        type: "object",
        properties: { formId: id },
        required: ["formId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleForms.prepareUpdate",
      functionName: "google_forms_update_prepare",
      aliases: ["google_forms_update_prepare"],
      capability: "form_draft",
      platformCapability: "google_forms_form_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Validate one form-create or question-create change locally.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["form_create", "question_create"],
          },
          formId: id,
          title: { type: "string", minLength: 1, maxLength: 1000 },
        },
        required: ["operation", "title"],
        additionalProperties: false,
      },
    },
    {
      name: "googleForms.createForm",
      functionName: "google_forms_form_create",
      aliases: ["google_forms_form_create"],
      capability: "form_write",
      platformCapability: "google_forms_form_write",
      action: "write",
      approvalRequired: true,
      description: "Create one unpublished Form after approval checks.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 500 },
          documentTitle: { type: "string", minLength: 1, maxLength: 500 },
          approvalId,
          idempotencyKey,
        },
        required: ["title", "approvalId", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "googleForms.createQuestion",
      functionName: "google_forms_question_create",
      aliases: ["google_forms_question_create"],
      capability: "form_write",
      platformCapability: "google_forms_form_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one bounded text or choice question after approval checks.",
      inputSchema: {
        type: "object",
        properties: {
          formId: id,
          title: { type: "string", minLength: 1, maxLength: 1000 },
          questionType: { type: "string", enum: ["text", "choice"] },
          paragraph: { type: "boolean" },
          choiceType: {
            type: "string",
            enum: ["RADIO", "CHECKBOX", "DROP_DOWN"],
          },
          options: { type: "array", minItems: 1, maxItems: 50 },
          required: { type: "boolean" },
          index: { type: "integer", minimum: 0, maximum: 100 },
          requiredRevisionId: id,
          approvalId,
          idempotencyKey,
        },
        required: [
          "formId",
          "title",
          "questionType",
          "approvalId",
          "idempotencyKey",
        ],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_forms_safe",
      label: "Safe",
      description:
        "Bounded response-free structure reads and local preparation run automatically; form and question creation require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected tools run without Relay per-action approval while drive.file, response exclusion, explicit targeting, typed limits, audit, redaction, refresh, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "response-free-forms",
      label:
        "Google account, exact drive.file scope, app-visible Forms, and response exclusion",
      requiredScopes: GOOGLE_FORMS_SCOPES,
    },
  ],
};
