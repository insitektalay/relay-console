import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CONFLUENCE_REQUIRED_SCOPES = [
  "offline_access",
  "read:confluence-content.all",
  "read:confluence-space.summary",
  "search:confluence",
  "read:confluence-content.permission",
  "read:confluence-user",
  "read:confluence-groups",
  "read:confluence-props",
  "readonly:content.attachment:confluence",
  "write:confluence-content",
  "write:confluence-space",
  "write:confluence-file",
  "write:confluence-props",
  "write:confluence-groups",
  "manage:confluence-configuration",
  "read:analytics.content:confluence",
  "read:audit-log:confluence",
  "write:audit-log:confluence",
  "read:email-address:confluence",
  "write:content.restriction:confluence",
  "write:space.permission:confluence",
  "delete:attachment:confluence",
  "delete:blogpost:confluence",
  "delete:comment:confluence",
  "delete:content:confluence",
  "delete:custom-content:confluence",
  "delete:database:confluence",
  "delete:embed:confluence",
  "delete:folder:confluence",
  "delete:page:confluence",
  "delete:space:confluence",
  "delete:whiteboard:confluence",
] as const;

const read = action(
  "confluence_read",
  "Read Confluence",
  "Read and search content in the connected Confluence site.",
);
const write = action(
  "confluence_write",
  "Change Confluence",
  "Create, update, upload, archive, or delete content in the connected site.",
);
const admin = action(
  "confluence_admin",
  "Administer Confluence",
  "Use the selected account's authorized Confluence administration APIs.",
);
const guards = [
  action(
    "confluence_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "confluence_other_site",
    "Access another Confluence site",
    "Every request remains pinned to the Confluence Cloud site selected during sign-in.",
  ),
  action(
    "confluence_unsupported_api",
    "Call an unsupported API",
    "Relay permits only documented Confluence Cloud REST v2 and legacy v1 routes.",
  ),
  action(
    "confluence_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, uploads, request bodies, responses, redirects, and execution time.",
  ),
];
const requestSchema = {
  type: "object",
  properties: {
    method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
    path: { type: "string", minLength: 1, maxLength: 2000 },
    query: { type: "object" },
    json: { type: "object" },
    approvalId: { type: "string" },
  },
  required: ["method", "path"],
  additionalProperties: false,
};

export const CONFLUENCE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "confluence",
  name: "Confluence",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.atlassian.com/cloud/confluence/rest/v2/intro/",
  providerWebsiteUrl: "https://www.atlassian.com/software/confluence",
  capabilities: [
    {
      ...capability(
        "knowledge_read",
        "Read Confluence",
        "Read and search the selected site's spaces, content, users, and metadata.",
        true,
      ),
      platformCapability: "confluence_read",
    },
    {
      ...capability(
        "knowledge_write",
        "Manage Confluence",
        "Create, update, upload, archive, and delete authorized site content.",
        true,
      ),
      platformCapability: "confluence_write",
    },
    {
      ...capability(
        "administration",
        "Administer Confluence",
        "Manage authorized configuration, permissions, groups, and audit resources.",
        true,
      ),
      platformCapability: "confluence_admin",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.atlassian.com/authorize",
      tokenUrl: "https://auth.atlassian.com/oauth/token",
      requiredScopes: [...CONFLUENCE_REQUIRED_SCOPES],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "CONFLUENCE_CLIENT_ID",
        label: "Atlassian OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
      },
      {
        name: "CONFLUENCE_CLIENT_SECRET",
        label: "Atlassian OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      },
    ],
  },
  tools: [
    {
      name: "confluence.listSpaces",
      functionName: "confluence_list_spaces",
      aliases: ["confluence.listSpaces"],
      capability: "knowledge_read",
      platformCapability: "confluence_read",
      action: "read",
      approvalRequired: false,
      description: "List spaces in the connected site.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100 },
          cursor: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "confluence.listPages",
      functionName: "confluence_list_pages",
      aliases: ["confluence.listPages"],
      capability: "knowledge_read",
      platformCapability: "confluence_read",
      action: "read",
      approvalRequired: false,
      description: "List pages in the connected site.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100 },
          cursor: { type: "string" },
          spaceId: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "confluence.getPage",
      functionName: "confluence_get_page",
      aliases: ["confluence.getPage"],
      capability: "knowledge_read",
      platformCapability: "confluence_read",
      action: "read",
      approvalRequired: false,
      description: "Read one page by ID.",
      inputSchema: {
        type: "object",
        properties: {
          pageId: { type: "string" },
          bodyFormat: {
            type: "string",
            enum: ["storage", "atlas_doc_format", "view"],
          },
        },
        required: ["pageId"],
        additionalProperties: false,
      },
    },
    {
      name: "confluence.uploadAttachment",
      functionName: "confluence_upload_attachment",
      aliases: ["confluence.uploadAttachment"],
      capability: "knowledge_write",
      platformCapability: "confluence_write",
      action: "write",
      approvalRequired: true,
      description:
        "Upload one bounded attachment to one page in the connected site.",
      inputSchema: {
        type: "object",
        properties: {
          pageId: { type: "string" },
          filename: { type: "string" },
          mimeType: { type: "string" },
          fileBase64: { type: "string" },
          comment: { type: "string" },
          minorEdit: { type: "boolean" },
          approvalId: { type: "string" },
        },
        required: ["pageId", "filename", "mimeType", "fileBase64"],
        additionalProperties: false,
      },
    },
    {
      name: "confluence.request",
      functionName: "confluence_request",
      aliases: ["confluence.request"],
      capability: "administration",
      platformCapability: "confluence_admin",
      action: "admin",
      approvalRequired: true,
      description:
        "Call the current Confluence Cloud REST v2 or legacy v1 JSON surface on the site bound during OAuth.",
      inputSchema: requestSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "confluence_safe",
      label: "Safe",
      description:
        "Reads run directly; every write, delete, upload, or administrative request requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [write, admin],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected, provider-authorized Confluence action runs without Relay per-action approval; site binding, ownership, selected capabilities, bounds, audits, secret non-exposure, and Atlassian authorization still apply.",
      defaultSelected: false,
      allowedActions: [read, write, admin],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "site",
      label: "OAuth token and site-bound Confluence API validation",
    },
  ],
};
