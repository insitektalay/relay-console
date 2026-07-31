import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "pandadoc_document_list_recent",
    "List recent documents",
    "List at most twenty-five PandaDoc Document status summaries created during the previous fourteen days.",
  ),
  action(
    "pandadoc_document_status_get",
    "Read document status",
    "Read one exact lightweight PandaDoc Document status without calling the sensitive details endpoint.",
  ),
  action(
    "pandadoc_document_folder_list",
    "List document folders",
    "List at most twenty-five root PandaDoc Document Folder names and identifiers from page one.",
  ),
];

export const PANDADOC_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "pandadoc",
  name: "PandaDoc",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.pandadoc.com/reference/authentication-process",
  providerWebsiteUrl: "https://www.pandadoc.com/",
  capabilities: [
    {
      ...capability(
        "document_read",
        "Read document workflow status",
        "Read bounded Document status and root Folder metadata for the token-bound PandaDoc membership and workspace.",
        true,
      ),
      platformCapability: "pandadoc_document_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.pandadoc.com/oauth2/authorize",
      tokenUrl: "https://api.pandadoc.com/oauth2/access_token",
      refreshUrl: "https://api.pandadoc.com/oauth2/access_token",
      userInfoUrl: "https://api.pandadoc.com/public/v1/members",
      requiredScopes: ["read"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "pandadoc.listRecentDocuments",
      functionName: "pandadoc_document_list_recent",
      aliases: [
        "pandadoc.listRecentDocuments",
        "pandadoc_document_list_recent",
      ],
      capability: "document_read",
      platformCapability: "pandadoc_document_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five redacted Document status summaries created during the previous fourteen days.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "pandadoc.getDocumentStatus",
      functionName: "pandadoc_document_status_get",
      aliases: ["pandadoc.getDocumentStatus", "pandadoc_document_status_get"],
      capability: "document_read",
      platformCapability: "pandadoc_document_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact lightweight Document status without recipients, fields, pricing, content, metadata, approvals, locks or details.",
      inputSchema: {
        type: "object",
        properties: {
          documentId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,64}$",
          },
        },
        required: ["documentId"],
        additionalProperties: false,
      },
    },
    {
      name: "pandadoc.listDocumentFolders",
      functionName: "pandadoc_document_folder_list",
      aliases: [
        "pandadoc.listDocumentFolders",
        "pandadoc_document_folder_list",
      ],
      capability: "document_read",
      platformCapability: "pandadoc_document_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five root Document Folder names and identifiers from page one.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "pandadoc_safe",
      label: "Safe",
      description:
        "Every bounded PandaDoc read requires approval; people, fields, pricing, content, files, details, templates, workspace administration, webhooks and writes are outside Relay's V1 surface.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three selected bounded PandaDoc reads run without Relay per-action approval; membership/workspace binding, redaction, first-page bounds, audits, provider scope and limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "membership-workspace",
      label: "PandaDoc exact membership and token-bound workspace validation",
      requiredScopes: ["read"],
    },
  ],
};
