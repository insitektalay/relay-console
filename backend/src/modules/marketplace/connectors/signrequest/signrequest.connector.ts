import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "signrequest_document_list",
    "List document summaries",
    "List up to 25 first-page document lifecycle summaries visible to the connected user.",
  ),
  action(
    "signrequest_document_get",
    "Inspect a document",
    "Inspect lifecycle metadata for one explicit SignRequest document UUID.",
  ),
];
const blockedActions = [
  blocked(
    "signrequest_private_content",
    "Access private document content",
    "Files, PDF downloads, source URLs, frontend secrets, people, teams, signers, messages, fields, attachments, signing logs, and event history are blocked.",
  ),
  blocked(
    "signrequest_mutation",
    "Mutate or sign documents",
    "Creating, uploading, preparing, sending, signing, sharing, reminding, cancelling, deleting, and changing documents are blocked.",
  ),
  blocked(
    "signrequest_broader_authority",
    "Use broader authority",
    "The write scope, templates, sign requests, teams, members, API tokens, webhooks, integrations, partner impersonation, and administration are blocked.",
  ),
  blocked(
    "signrequest_raw_bulk",
    "Use raw or bulk APIs",
    "Raw paths, arbitrary filters or queries, search, pagination, polling, automatic retries, batch access, callbacks, and exports are blocked.",
  ),
];

export const SIGNREQUEST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "signrequest",
  name: "SignRequest",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.signrequest.com/api/v1/docs/",
  providerWebsiteUrl: "https://signrequest.com/en",
  capabilities: [
    {
      ...capability(
        "document_list",
        "List documents",
        "Read one bounded first page of document lifecycle metadata.",
        true,
      ),
      platformCapability: "signrequest_document_list",
    },
    {
      ...capability(
        "document_get",
        "Inspect document metadata",
        "Read lifecycle metadata for one explicit document UUID.",
        true,
      ),
      platformCapability: "signrequest_document_get",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://signrequest.com/api/v1/oauth2/authorize/",
      tokenUrl: "https://signrequest.com/api/v1/oauth2/token/",
      userInfoUrl: "https://signrequest.com/api/v1/documents/?limit=1",
      requiredScopes: ["read"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SIGNREQUEST_CLIENT_ID",
        label: "SignRequest OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned confidential OAuth application client ID configured on Railway.",
      },
      {
        name: "SIGNREQUEST_CLIENT_SECRET",
        label: "SignRequest OAuth client secret",
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
      name: "signRequest.listDocuments",
      functionName: "signrequest_document_list",
      aliases: ["signrequest_document_list"],
      capability: "document_list",
      platformCapability: "signrequest_document_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 first-page lifecycle summaries without people, teams, files, or signing content.",
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
      name: "signRequest.getDocument",
      functionName: "signrequest_document_get",
      aliases: ["signrequest_document_get"],
      capability: "document_get",
      platformCapability: "signrequest_document_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read lifecycle metadata for one explicit document UUID without people, files, signing, or audit data.",
      inputSchema: {
        type: "object",
        properties: {
          documentUuid: { type: "string", minLength: 36, maxLength: 36 },
        },
        required: ["documentUuid"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "signrequest_read_only",
      label: "Read-only document lifecycle",
      description:
        "Two bounded reads run automatically with exactly SignRequest's read scope; private content, writes, broader authority, raw access, and bulk transfer remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The exact read scope, fixed origin and paths, strict projection, result cap, and read-only boundary remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "oauth_read", label: "OAuth token and exact read scope" },
  ],
};
