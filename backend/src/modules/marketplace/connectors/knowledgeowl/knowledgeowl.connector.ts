import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("knowledgeowl_list_articles", "List articles", "List one bounded page of articles in the connected knowledge base."),
  action("knowledgeowl_get_article", "Read article", "Read one article from the connected knowledge base."),
  action("knowledgeowl_list_categories", "List categories", "List one bounded page of categories in the connected knowledge base."),
];
const full = [
  action("knowledgeowl_upload_file", "Upload file", "Upload one bounded file to the connected knowledge base; Safe mode requires approval."),
  action("knowledgeowl_full_api", "Use full External API", "Use any current documented KnowledgeOwl External API operation; Safe mode requires approval."),
];

export const KNOWLEDGEOWL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "knowledgeowl", name: "KnowledgeOwl", connectorType: "native_clawchat",
  providerDocsUrl: "https://support.knowledgeowl.com/help/api-endpoint-reference", providerWebsiteUrl: "https://www.knowledgeowl.com/",
  capabilities: [
    { ...capability("knowledge_read", "Read knowledge", "List and read bounded articles and categories in the configured knowledge base.", true), platformCapability: "knowledgeowl_knowledge_read" },
    { ...capability("knowledge_write", "Maintain knowledge", "Create, update, version, upload, organize, and delete content permitted by the key.", true), platformCapability: "knowledgeowl_knowledge_write" },
    { ...capability("people_admin", "Manage people and access", "Manage agents, readers, roles, teams, and reader filters permitted by the key.", true), platformCapability: "knowledgeowl_people_admin" },
    { ...capability("administration", "Manage knowledge-base resources", "Manage filters, snippets, synonyms, tags, webhooks, files, comments, and remote-login resources.", true), platformCapability: "knowledgeowl_administration" },
  ],
  auth: { type: "api_key", credentialSchema: [
    { name: "KNOWLEDGEOWL_PROJECT_ID", label: "KnowledgeOwl knowledge base ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Copy the project ID shown after /articles/id/ in the KnowledgeOwl admin URL." },
    { name: "KNOWLEDGEOWL_API_KEY", label: "KnowledgeOwl API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "A Full Admin creates a dedicated key under Account > API and limits its HTTP methods to the intended policy." },
  ] },
  tools: [
    { name: "knowledgeowl.listArticles", functionName: "knowledgeowl_list_articles", aliases: ["knowledgeowl.listArticles", "knowledgeowl_list_articles"], capability: "knowledge_read", platformCapability: "knowledgeowl_knowledge_read", action: "read", approvalRequired: false, description: "List a bounded page of articles in the configured knowledge base.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 10000 }, limit: { type: "number", minimum: 1, maximum: 100 }, status: { type: "string", maxLength: 100 } }, additionalProperties: false } },
    { name: "knowledgeowl.getArticle", functionName: "knowledgeowl_get_article", aliases: ["knowledgeowl.getArticle", "knowledgeowl_get_article"], capability: "knowledge_read", platformCapability: "knowledgeowl_knowledge_read", action: "read", approvalRequired: false, description: "Read one article in the configured knowledge base.", inputSchema: { type: "object", properties: { articleId: { type: "string", maxLength: 200 } }, required: ["articleId"], additionalProperties: false } },
    { name: "knowledgeowl.listCategories", functionName: "knowledgeowl_list_categories", aliases: ["knowledgeowl.listCategories", "knowledgeowl_list_categories"], capability: "knowledge_read", platformCapability: "knowledgeowl_knowledge_read", action: "read", approvalRequired: false, description: "List a bounded page of categories in the configured knowledge base.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 10000 }, limit: { type: "number", minimum: 1, maximum: 100 } }, additionalProperties: false } },
    { name: "knowledgeowl.uploadFile", functionName: "knowledgeowl_upload_file", aliases: ["knowledgeowl.uploadFile", "knowledgeowl_upload_file"], capability: "knowledge_write", platformCapability: "knowledgeowl_knowledge_write", action: "write", approvalRequired: true, description: "Upload one file of at most 5 MB to the configured knowledge base.", inputSchema: { type: "object", properties: { filename: { type: "string", maxLength: 200 }, fileBase64: { type: "string", maxLength: 7000000 }, status: { type: "string", enum: ["active", "inactive"] }, approvalId: { type: "string" } }, required: ["filename", "fileBase64"], additionalProperties: false } },
    { name: "knowledgeowl.request", functionName: "knowledgeowl_request", aliases: ["knowledgeowl.request", "knowledgeowl_request", "knowledgeowl_full_api"], capability: "administration", platformCapability: "knowledgeowl_administration", action: "admin", approvalRequired: true, description: "Call an exact method/path pair from the current KnowledgeOwl External API specification on the fixed official origin.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "knowledgeowl_safe", label: "Safe", description: "Bounded article and category reads run directly; uploads and every other External API operation require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: full, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected API-key-authorized KnowledgeOwl operation runs without Relay per-action approval; ownership, fixed origin, project binding, bounds, audits, redaction, key method permissions, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...full], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "articles", label: "KnowledgeOwl project and API-key validation" }],
};
