import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("tettra_search", "Search pages", "Return Tettra's bounded page search results."),
  action("tettra_get_category_items", "Browse category", "List items in one permitted category."),
];
const writes = [
  action("tettra_create_page", "Create page", "Publish a new HTML page; Safe mode requires approval."),
  action("tettra_update_page", "Update page", "Replace selected page fields; Safe mode requires approval."),
  action("tettra_create_suggestion", "Create suggestion", "Suggest a new page or page update; Safe mode requires approval."),
  action("tettra_create_question", "Ask question", "Create and optionally assign a question; Safe mode requires approval."),
  action("tettra_create_category", "Create category", "Create a top-level category; Safe mode requires approval."),
];

export const TETTRA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "tettra", name: "Tettra", connectorType: "native_clawchat",
  providerDocsUrl: "https://support.tettra.com/api-overview", providerWebsiteUrl: "https://tettra.com/",
  capabilities: [
    { ...capability("knowledge_read", "Read knowledge", "Search pages and browse permitted category items.", true), platformCapability: "tettra_knowledge_read" },
    { ...capability("knowledge_write", "Create and update pages", "Publish pages, replace permitted page fields, and create page suggestions.", true), platformCapability: "tettra_knowledge_write" },
    { ...capability("questions", "Ask and assign questions", "Create questions and assign them to permitted Tettra users.", true), platformCapability: "tettra_questions" },
    { ...capability("category_admin", "Create categories", "Create top-level categories under the connected user's authority.", true), platformCapability: "tettra_category_admin" },
  ],
  auth: { type: "api_key", credentialSchema: [
    { name: "TETTRA_TEAM_ID", label: "Tettra team ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Copy the numeric team ID from the Tettra team URL or API example." },
    { name: "TETTRA_API_KEY", label: "Tettra API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Generate a user-and-team-bound API key under My settings on an eligible Tettra plan." },
  ] },
  tools: [
    { name: "tettra.search", functionName: "tettra_search", aliases: ["tettra.search", "tettra_search"], capability: "knowledge_read", platformCapability: "tettra_knowledge_read", action: "read", approvalRequired: false, description: "Search up to five accessible Tettra pages.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 2000 } }, additionalProperties: false } },
    { name: "tettra.getCategoryItems", functionName: "tettra_get_category_items", aliases: ["tettra.getCategoryItems", "tettra_get_category_items"], capability: "knowledge_read", platformCapability: "tettra_knowledge_read", action: "read", approvalRequired: false, description: "List items in one accessible category.", inputSchema: { type: "object", properties: { categoryId: { type: "string", pattern: "^[0-9]+$" } }, required: ["categoryId"], additionalProperties: false } },
    { name: "tettra.createPage", functionName: "tettra_create_page", aliases: ["tettra.createPage", "tettra_create_page"], capability: "knowledge_write", platformCapability: "tettra_knowledge_write", action: "write", approvalRequired: true, description: "Publish one page from bounded HTML.", inputSchema: { type: "object", properties: { title: { type: "string", maxLength: 500 }, body: { type: "string", maxLength: 200000 }, categoryId: { type: "string", pattern: "^[0-9]+$" }, subcategoryId: { type: "string", pattern: "^[0-9]+$" }, approvalId: { type: "string" } }, required: ["title", "body"], additionalProperties: false } },
    { name: "tettra.updatePage", functionName: "tettra_update_page", aliases: ["tettra.updatePage", "tettra_update_page"], capability: "knowledge_write", platformCapability: "tettra_knowledge_write", action: "write", approvalRequired: true, description: "Update one page's owner, title, HTML body, or location.", inputSchema: { type: "object", properties: { pageId: { type: "string", pattern: "^[0-9]+$" }, ownerId: { type: "string", pattern: "^[0-9]+$" }, title: { type: "string", maxLength: 500 }, body: { type: "string", maxLength: 200000 }, categoryId: { type: "string", pattern: "^[0-9]+$" }, subcategoryId: { type: "string", pattern: "^[0-9]+$" }, approvalId: { type: "string" } }, required: ["pageId"], additionalProperties: false } },
    { name: "tettra.createSuggestion", functionName: "tettra_create_suggestion", aliases: ["tettra.createSuggestion", "tettra_create_suggestion"], capability: "knowledge_write", platformCapability: "tettra_knowledge_write", action: "write", approvalRequired: true, description: "Suggest a new page or an update to an existing page.", inputSchema: { type: "object", properties: { title: { type: "string", maxLength: 500 }, description: { type: "string", maxLength: 20000 }, pageId: { type: "string", pattern: "^[0-9]+$" }, categoryId: { type: "string", pattern: "^[0-9]+$" }, assignableId: { type: "string", pattern: "^[0-9]+$" }, approvalId: { type: "string" } }, additionalProperties: false } },
    { name: "tettra.createQuestion", functionName: "tettra_create_question", aliases: ["tettra.createQuestion", "tettra_create_question"], capability: "questions", platformCapability: "tettra_questions", action: "write", approvalRequired: true, description: "Create and optionally assign one Tettra question.", inputSchema: { type: "object", properties: { title: { type: "string", maxLength: 500 }, details: { type: "string", maxLength: 20000 }, categoryId: { type: "string", pattern: "^[0-9]+$" }, subcategoryId: { type: "string", pattern: "^[0-9]+$" }, assigneeIds: { type: "array", maxItems: 50, items: { type: "string", pattern: "^[0-9]+$" } }, approvalId: { type: "string" } }, required: ["title"], additionalProperties: false } },
    { name: "tettra.createCategory", functionName: "tettra_create_category", aliases: ["tettra.createCategory", "tettra_create_category"], capability: "category_admin", platformCapability: "tettra_category_admin", action: "admin", approvalRequired: true, description: "Create one top-level category.", inputSchema: { type: "object", properties: { name: { type: "string", maxLength: 191 }, description: { type: "string", maxLength: 20000 }, approvalId: { type: "string" } }, required: ["name"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "tettra_safe", label: "Safe", description: "Bounded search and category browsing run directly; every published mutation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected API-key-authorized Tettra operation runs without Relay per-action approval; ownership, fixed origin, bounds, audits, redaction, plan, and user permissions still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "recent_pages", label: "Tettra team key and recent-pages search" }],
};
