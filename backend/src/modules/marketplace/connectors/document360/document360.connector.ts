import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("document360_list_workspaces", "List workspaces", "List the connected project's workspaces."),
  action("document360_list_articles", "List articles", "List one bounded page of workspace articles."),
  action("document360_get_article", "Read article", "Read one article translation without SAS-token expansion."),
];
const full = [
  action("document360_full_api", "Use full Customer API", "Use any documented Document360 Customer API v2 operation; Safe mode requires approval."),
];

export const DOCUMENT360_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "document360",
  name: "Document360",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://apidocs.document360.com/apidocs/endpoints-introduction",
  providerWebsiteUrl: "https://document360.com/",
  capabilities: [
    { ...capability("knowledge_read", "Read knowledge", "Discover workspaces and read bounded article metadata and content.", true), platformCapability: "document360_knowledge_read" },
    { ...capability("knowledge_write", "Create and maintain knowledge", "Create, update, publish, translate, import, export, organize, and delete token-authorized knowledge.", true), platformCapability: "document360_knowledge_write" },
    { ...capability("administration", "Manage project resources", "Manage API references, Drive, readers, teams, groups, roles, workflows, languages, and custom fields permitted by the token.", true), platformCapability: "document360_administration" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "DOCUMENT360_API_TOKEN", label: "Document360 API token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated project token under Settings > Knowledge base portal > API tokens and select the intended HTTP methods." },
      { name: "DOCUMENT360_API_ORIGIN", label: "Document360 API origin", required: false, secret: false, storedIn: "metadata", helpText: "Optional official API Hub origin for US or private hosting. Defaults to https://apihub.document360.io." },
    ],
  },
  tools: [
    { name: "document360.listWorkspaces", functionName: "document360_list_workspaces", aliases: ["document360.listWorkspaces", "document360_list_workspaces"], capability: "knowledge_read", platformCapability: "document360_knowledge_read", action: "read", approvalRequired: false, description: "List project workspaces through the primary discovery endpoint.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "document360.listArticles", functionName: "document360_list_articles", aliases: ["document360.listArticles", "document360_list_articles"], capability: "knowledge_read", platformCapability: "document360_knowledge_read", action: "read", approvalRequired: false, description: "List a bounded page of articles in one workspace.", inputSchema: { type: "object", properties: { projectVersionId: { type: "string", maxLength: 200 }, languageCode: { type: "string", maxLength: 20 }, page: { type: "number", minimum: 0, maximum: 10000 }, hitsPerPage: { type: "number", minimum: 1, maximum: 100 } }, required: ["projectVersionId"], additionalProperties: false } },
    { name: "document360.getArticle", functionName: "document360_get_article", aliases: ["document360.getArticle", "document360_get_article"], capability: "knowledge_read", platformCapability: "document360_knowledge_read", action: "read", approvalRequired: false, description: "Read one article translation without expanding private SAS URLs.", inputSchema: { type: "object", properties: { articleId: { type: "string", maxLength: 200 }, languageCode: { type: "string", maxLength: 20 }, versionNumber: { type: "number", minimum: 1, maximum: 100000 } }, required: ["articleId", "languageCode"], additionalProperties: false } },
    { name: "document360.request", functionName: "document360_request", aliases: ["document360.request", "document360_request", "document360_full_api"], capability: "administration", platformCapability: "document360_administration", action: "admin", approvalRequired: true, description: "Call any documented v2 Customer API operation on the configured official API Hub origin.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] }, path: { type: "string", pattern: "^/v2/" }, query: { type: "object" }, json: { type: "object" }, projectId: { type: "string", maxLength: 200 }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "document360_safe", label: "Safe", description: "Bounded workspace and article reads run directly; every other Customer API call requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: full, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected token-authorized Document360 operation runs without Relay per-action approval; ownership, fixed official origin, token method permissions, bounds, audits, redaction, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...full], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "project_versions", label: "Document360 project-token validation" }],
};
