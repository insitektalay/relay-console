import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "rightsignature_document_list",
    "List documents",
    "List up to 25 first-page document lifecycle summaries for one explicit state.",
  ),
  action(
    "rightsignature_document_get",
    "Inspect a document",
    "Inspect lifecycle metadata for one explicit document UUID.",
  ),
];
const blockedActions = [
  blocked(
    "rightsignature_private_content",
    "Access private document content",
    "Filenames, PDFs, original or signed files, certificates, thumbnails, participants, signers, shared users, messages, fields, tags, identity data, and URLs are blocked.",
  ),
  blocked(
    "rightsignature_mutation",
    "Mutate or send documents",
    "Preparing, uploading, sending, embedding, sharing, signing, reminding, voiding, updating, deleting, and administering are blocked.",
  ),
  blocked(
    "rightsignature_broader_authority",
    "Use broader authority",
    "The write scope, private API tokens, templates, sending requests, signer operations, users, callbacks, and webhooks are blocked.",
  ),
  blocked(
    "rightsignature_raw_bulk",
    "Use raw or bulk APIs",
    "Raw paths, search, template filters, arbitrary queries, pagination, polling, automatic retries, batch access, and exports are blocked.",
  ),
];

export const RIGHTSIGNATURE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "rightsignature",
  name: "RightSignature",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://api.rightsignature.com/documentation/authentication",
  providerWebsiteUrl:
    "https://www.sharefile.com/features/electronic-signatures",
  capabilities: [
    {
      ...capability(
        "document_list",
        "List documents",
        "Read a bounded first page of privacy-redacted document lifecycle metadata.",
        true,
      ),
      platformCapability: "rightsignature_document_list",
    },
    {
      ...capability(
        "document_get",
        "Inspect document metadata",
        "Read privacy-redacted lifecycle metadata for one explicit document.",
        true,
      ),
      platformCapability: "rightsignature_document_get",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.rightsignature.com/oauth/authorize",
      tokenUrl: "https://api.rightsignature.com/oauth/token",
      revocationUrl: "https://api.rightsignature.com/oauth/revoke",
      userInfoUrl:
        "https://api.rightsignature.com/public/v2/documents?per_page=1&page=1&state=pending",
      requiredScopes: ["read"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "RIGHTSIGNATURE_CLIENT_ID",
        label: "RightSignature OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned approved API key client ID configured on Railway.",
      },
      {
        name: "RIGHTSIGNATURE_CLIENT_SECRET",
        label: "RightSignature OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned client secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "rightsignature.listDocuments",
      functionName: "rightsignature_document_list",
      aliases: ["rightsignature_document_list"],
      capability: "document_list",
      platformCapability: "rightsignature_document_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 first-page privacy-redacted document lifecycle summaries for one state.",
      inputSchema: {
        type: "object",
        properties: {
          state: {
            type: "string",
            enum: [
              "draft",
              "pending",
              "executed",
              "voided",
              "expired",
              "declined",
              "editing",
            ],
          },
          resultLimit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            default: 25,
          },
        },
        required: ["state"],
        additionalProperties: false,
      },
    },
    {
      name: "rightsignature.getDocument",
      functionName: "rightsignature_document_get",
      aliases: ["rightsignature_document_get"],
      capability: "document_get",
      platformCapability: "rightsignature_document_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read privacy-redacted lifecycle metadata for one explicit document UUID.",
      inputSchema: {
        type: "object",
        properties: {
          documentId: {
            type: "string",
            minLength: 36,
            maxLength: 36,
            pattern:
              "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
          },
        },
        required: ["documentId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "rightsignature_read_only",
      label: "Read-only document lifecycle",
      description:
        "Two fixed privacy-redacted document metadata reads run automatically with exactly RightSignature's read scope.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Exact read scope, fixed paths, strict projection, result cap, and read-only boundary remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "oauth_read",
      label: "OAuth token, exact read scope, and bounded document read",
      requiredScopes: ["read"],
    },
  ],
};
