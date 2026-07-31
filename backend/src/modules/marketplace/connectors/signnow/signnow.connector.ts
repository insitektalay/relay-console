import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "signnow_document_list",
    "List document summaries",
    "List up to 25 first-page document metadata summaries owned by the connected user.",
  ),
  action(
    "signnow_document_get",
    "Inspect a document",
    "Inspect lifecycle metadata for one explicit SignNow document ID.",
  ),
];
const blockedActions = [
  blocked(
    "signnow_private_content",
    "Access private document content",
    "Files, downloads, thumbnails, page images, fields, filled values, signer and recipient identity, signatures, invitations, messages, attachments, and audit data are blocked.",
  ),
  blocked(
    "signnow_mutation",
    "Mutate or sign documents",
    "Uploading, creating, editing, sending, signing, sharing, reminding, cancelling, deleting, and generating signing links are blocked.",
  ),
  blocked(
    "signnow_broader_authority",
    "Use broad provider authority",
    "Templates, document groups, teams, organizations, users, webhooks, embedded signing, account administration, and every other capability conveyed by SignNow's broad OAuth token are blocked.",
  ),
  blocked(
    "signnow_raw_bulk",
    "Use raw or bulk APIs",
    "Raw paths, arbitrary queries, pagination, polling, automatic retries, batch access, and exports are blocked.",
  ),
];

export const SIGNNOW_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "signnow",
  name: "SignNow",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.signnow.com/",
  providerWebsiteUrl: "https://www.signnow.com/developers",
  capabilities: [
    {
      ...capability(
        "document_list",
        "List documents",
        "Read a bounded first page of self-owned document metadata.",
        true,
      ),
      platformCapability: "signnow_document_list",
    },
    {
      ...capability(
        "document_get",
        "Inspect document metadata",
        "Read lifecycle metadata for one explicit document.",
        true,
      ),
      platformCapability: "signnow_document_get",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.signnow.com/authorize",
      tokenUrl: "https://api.signnow.com/oauth2/token",
      userInfoUrl: "https://api.signnow.com/user",
      requiredScopes: ["*"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SIGNNOW_CLIENT_ID",
        label: "SignNow OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned OAuth application client ID configured on Railway.",
      },
      {
        name: "SIGNNOW_CLIENT_SECRET",
        label: "SignNow OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential client secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "signNow.listDocuments",
      functionName: "signnow_document_list",
      aliases: ["signnow_document_list"],
      capability: "document_list",
      platformCapability: "signnow_document_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 first-page document metadata summaries without people or document content.",
      inputSchema: {
        type: "object",
        properties: {
          resultLimit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            default: 25,
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "signNow.getDocument",
      functionName: "signnow_document_get",
      aliases: ["signnow_document_get"],
      capability: "document_get",
      platformCapability: "signnow_document_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read lifecycle metadata for one explicit document ID without people, content, signing, or audit data.",
      inputSchema: {
        type: "object",
        properties: {
          documentId: { type: "string", minLength: 1, maxLength: 128 },
        },
        required: ["documentId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "signnow_read_only",
      label: "Read-only document metadata",
      description:
        "Two bounded metadata reads run automatically; SignNow's broad token is contained behind fixed paths, strict projection, and blocked writes.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Fixed paths, strict field projection, the result cap, and Relay's read-only boundary remain enforced despite the provider's broad token.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "oauth_identity",
      label: "OAuth token and connected SignNow user binding",
    },
  ],
};
