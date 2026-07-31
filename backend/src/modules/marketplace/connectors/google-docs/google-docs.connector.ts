import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_DOCS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
];

const reads = [
  action(
    "google_docs_read_document",
    "Read document",
    "Read bounded text and metadata from one user-specified, app-visible Google Doc.",
  ),
  action(
    "google_docs_prepare_update",
    "Prepare document change",
    "Prepare and hash one bounded document change locally without changing Google Docs.",
  ),
];
const writes = [
  action(
    "google_docs_create_document",
    "Create document",
    "Create one bounded Google Doc and optionally insert its initial text.",
  ),
  action(
    "google_docs_apply_document_update",
    "Apply document update",
    "Insert or replace bounded text in one exact app-visible Google Doc.",
  ),
];
const blockedActions = [
  blocked(
    "google_docs_discovery",
    "Search Drive or discover documents",
    "Drive search, whole-Drive access, automatic pagination, and shared-drive crawling are outside V1.",
  ),
  blocked(
    "google_docs_collaboration_admin",
    "Change sharing or collaboration",
    "Permissions, ownership, comments, suggestions, domain-wide delegation, and administration are outside V1.",
  ),
  blocked(
    "google_docs_destructive",
    "Delete or move documents",
    "Delete, trash, move, broad formatting replacement, and other destructive document operations are outside V1.",
  ),
  blocked(
    "google_docs_raw",
    "Run broad or raw operations",
    "Export, import, raw API or MCP calls, media, and unbounded payloads are outside V1.",
  ),
];

const identifier = {
  type: "string",
  minLength: 1,
  maxLength: 200,
  pattern: "^[A-Za-z0-9_-]+$",
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const idempotencyKey = { type: "string", minLength: 8, maxLength: 200 };

export const GOOGLE_DOCS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-docs",
  name: "Google Docs",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/workspace/docs/api/auth",
  providerWebsiteUrl: "https://docs.google.com/",
  capabilities: [
    {
      ...capability(
        "document_read",
        "Read documents",
        "Read bounded text and metadata from one exact app-visible Google Doc.",
        true,
      ),
      platformCapability: "google_docs_document_read",
    },
    {
      ...capability(
        "document_draft",
        "Prepare changes",
        "Prepare and hash bounded document changes locally.",
        true,
      ),
      platformCapability: "google_docs_document_draft",
    },
    {
      ...capability(
        "document_write",
        "Create and update documents",
        "Create documents and apply constrained text updates after policy checks.",
        true,
      ),
      platformCapability: "google_docs_document_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_DOCS_SCOPES,
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
      name: "googleDocs.readDocument",
      functionName: "google_docs_read_document",
      aliases: ["google_docs_read_document"],
      capability: "document_read",
      platformCapability: "google_docs_document_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most twelve thousand text characters from one exact app-visible Google Doc.",
      inputSchema: {
        type: "object",
        properties: {
          documentId: identifier,
          maxBodyChars: { type: "integer", minimum: 200, maximum: 12000 },
        },
        required: ["documentId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleDocs.prepareChange",
      functionName: "google_docs_prepare_update",
      aliases: ["google_docs_prepare_update"],
      capability: "document_draft",
      platformCapability: "google_docs_document_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare and hash one bounded insert or replace-all text change locally.",
      inputSchema: {
        type: "object",
        properties: {
          documentId: identifier,
          insertText: { type: "string", minLength: 1, maxLength: 20000 },
          insertIndex: { type: "integer", minimum: 1, maximum: 1000000 },
          findText: { type: "string", minLength: 1, maxLength: 500 },
          replaceText: { type: "string", maxLength: 20000 },
          matchCase: { type: "boolean" },
        },
        required: ["documentId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleDocs.createDocument",
      functionName: "google_docs_create_document",
      aliases: ["google_docs_create_document"],
      capability: "document_write",
      platformCapability: "google_docs_document_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one Google Doc with optional bounded initial text after approval checks.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          bodyText: { type: "string", maxLength: 20000 },
          approvalId,
          idempotencyKey,
        },
        required: ["title", "approvalId", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "googleDocs.applyChange",
      functionName: "google_docs_apply_document_update",
      aliases: ["google_docs_apply_document_update"],
      capability: "document_write",
      platformCapability: "google_docs_document_write",
      action: "write",
      approvalRequired: true,
      description:
        "Apply one bounded insert or replace-all text change to one exact Google Doc after approval checks.",
      inputSchema: {
        type: "object",
        properties: {
          documentId: identifier,
          insertText: { type: "string", minLength: 1, maxLength: 20000 },
          insertIndex: { type: "integer", minimum: 1, maximum: 1000000 },
          findText: { type: "string", minLength: 1, maxLength: 500 },
          replaceText: { type: "string", maxLength: 20000 },
          matchCase: { type: "boolean" },
          requiredRevisionId: { type: "string", minLength: 1, maxLength: 200 },
          approvalId,
          idempotencyKey,
        },
        required: ["documentId", "approvalId", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_docs_safe",
      label: "Safe",
      description:
        "Bounded exact-document reads and local preparation run automatically; creates and updates require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected tools run without Relay per-action approval while drive.file, exact-document targeting, account binding, payload limits, audit, redaction, refresh, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "app-visible-documents",
      label:
        "Google account, exact drive.file scope, refresh lifecycle, and app-visible document access",
      requiredScopes: GOOGLE_DOCS_SCOPES,
    },
  ],
};
