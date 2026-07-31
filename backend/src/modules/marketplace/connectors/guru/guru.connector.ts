import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("guru_list_teams", "List teams", "Verify the connected Guru organization."),
  action("guru_search_cards", "Search cards", "Search a bounded page of permitted Guru Cards."),
  action("guru_list_agents", "List Knowledge Agents", "List permitted Guru Knowledge Agents through Guru MCP."),
  action("guru_ask", "Ask Knowledge Agent", "Ask a bounded question and receive Guru's verified, cited answer."),
  action("guru_mcp_search", "Search connected knowledge", "Search permitted Guru Cards and connected sources through Guru MCP."),
];
const writes = [
  action("guru_create_draft", "Create card draft", "Create a Guru Card draft; Safe mode requires approval."),
  action("guru_update_card", "Suggest card update", "Suggest an update to an existing Guru Card; Safe mode requires approval."),
  action("guru_upload_file", "Upload file", "Upload one bounded file to a documented Guru API endpoint; Safe mode requires approval."),
  action("guru_full_api", "Use full Guru API", "Use any documented Guru REST API v1 operation; Safe mode requires approval."),
];

export const GURU_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "guru",
  name: "Guru",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.getguru.com/docs/getting-started",
  providerWebsiteUrl: "https://www.getguru.com/",
  capabilities: [
    { ...capability("knowledge_read", "Read trusted knowledge", "Read teams, search Cards and connected sources, list Knowledge Agents, and ask verified questions.", true), platformCapability: "guru_knowledge_read" },
    { ...capability("knowledge_write", "Create and update knowledge", "Create Card drafts, suggest Card updates, upload supported content, and use the complete delegated Guru API v1 surface.", true), platformCapability: "guru_knowledge_write" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.getguru.com/oauth/authorize",
      tokenUrl: "https://api.getguru.com/oauth/token",
      userInfoUrl: "https://api.getguru.com/api/v1/teams",
      requiredScopes: ["default"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      { name: "GURU_CLIENT_ID", label: "Guru OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay-owned OAuth client ID configured on Railway after Guru Support enables the client." },
      { name: "GURU_CLIENT_SECRET", label: "Guru OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay-owned OAuth client secret stored only in Railway secret variables." },
    ],
  },
  tools: [
    { name: "guru.listTeams", functionName: "guru_list_teams", aliases: ["guru.listTeams", "guru_list_teams"], capability: "knowledge_read", platformCapability: "guru_knowledge_read", action: "read", approvalRequired: false, description: "List the OAuth-authorized Guru teams.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "guru.searchCards", functionName: "guru_search_cards", aliases: ["guru.searchCards", "guru_search_cards"], capability: "knowledge_read", platformCapability: "guru_knowledge_read", action: "read", approvalRequired: false, description: "Search a bounded page of Guru Cards.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 1000 }, filter: { type: "string", maxLength: 2000 }, showArchived: { type: "boolean" }, maxResults: { type: "number", minimum: 1, maximum: 50 }, sortField: { type: "string", enum: ["lastModified", "lastModifiedBy", "boardCount", "verificationState", "copyCount", "viewCount", "favoriteCount", "dateCreated", "verificationInterval", "verifier", "owner", "lastVerifiedBy", "lastVerified", "popularity", "title"] }, sortOrder: { type: "string", enum: ["asc", "desc"] }, pageToken: { type: "string", maxLength: 2000 } }, required: ["query"], additionalProperties: false } },
    { name: "guru.listKnowledgeAgents", functionName: "guru_list_knowledge_agents", aliases: ["guru.listKnowledgeAgents", "guru_list_knowledge_agents"], capability: "knowledge_read", platformCapability: "guru_knowledge_read", action: "read", approvalRequired: false, description: "List permitted Guru Knowledge Agents through a typed MCP wrapper.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "guru.ask", functionName: "guru_ask", aliases: ["guru.ask", "guru_ask"], capability: "knowledge_read", platformCapability: "guru_knowledge_read", action: "read", approvalRequired: false, description: "Ask a bounded question through a permitted Guru Knowledge Agent.", inputSchema: { type: "object", properties: { question: { type: "string", maxLength: 10000 }, agentId: { type: "string", maxLength: 500 } }, required: ["question"], additionalProperties: false } },
    { name: "guru.searchKnowledge", functionName: "guru_search_knowledge", aliases: ["guru.searchKnowledge", "guru_search_knowledge"], capability: "knowledge_read", platformCapability: "guru_knowledge_read", action: "read", approvalRequired: false, description: "Search Guru Cards and connected sources through a typed MCP wrapper.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 2000 }, agentId: { type: "string", maxLength: 500 }, limit: { type: "number", minimum: 1, maximum: 50 } }, required: ["query"], additionalProperties: false } },
    { name: "guru.createDraft", functionName: "guru_create_draft", aliases: ["guru.createDraft", "guru_create_draft"], capability: "knowledge_write", platformCapability: "guru_knowledge_write", action: "write", approvalRequired: true, description: "Create a Guru Card draft through a typed MCP wrapper.", inputSchema: { type: "object", properties: { title: { type: "string", maxLength: 500 }, content: { type: "string", maxLength: 100000 }, collectionId: { type: "string", maxLength: 500 }, approvalId: { type: "string" } }, required: ["title", "content"], additionalProperties: false } },
    { name: "guru.updateCard", functionName: "guru_update_card", aliases: ["guru.updateCard", "guru_update_card"], capability: "knowledge_write", platformCapability: "guru_knowledge_write", action: "write", approvalRequired: true, description: "Suggest a Guru Card update through a typed MCP wrapper.", inputSchema: { type: "object", properties: { cardId: { type: "string", maxLength: 500 }, content: { type: "string", maxLength: 100000 }, message: { type: "string", maxLength: 2000 }, approvalId: { type: "string" } }, required: ["cardId", "content"], additionalProperties: false } },
    { name: "guru.uploadFile", functionName: "guru_upload_file", aliases: ["guru.uploadFile", "guru_upload_file"], capability: "knowledge_write", platformCapability: "guru_knowledge_write", action: "write", approvalRequired: true, description: "Upload one bounded file to a documented fixed-origin Guru API endpoint.", inputSchema: { type: "object", properties: { path: { type: "string", pattern: "^/api/v1/" }, fieldName: { type: "string", enum: ["file", "logo", "image", "zip"] }, filename: { type: "string", maxLength: 200 }, mimeType: { type: "string", enum: ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "application/zip", "text/csv", "text/plain"] }, fileBase64: { type: "string", maxLength: 14000000 }, fields: { type: "object" }, approvalId: { type: "string" } }, required: ["path", "filename", "mimeType", "fileBase64"], additionalProperties: false } },
    { name: "guru.request", functionName: "guru_request", aliases: ["guru.request", "guru_request", "guru_full_api"], capability: "knowledge_write", platformCapability: "guru_knowledge_write", action: "admin", approvalRequired: true, description: "Call any documented api.getguru.com /api/v1 endpoint. Absolute URLs and credential-bearing fields are rejected.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] }, path: { type: "string", pattern: "^/api/v1/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "guru_safe", label: "Safe", description: "Bounded organization, search, and verified-answer reads run directly; creation, updates, uploads, and every other API operation require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Guru operation runs without Relay per-action approval; ownership, organization binding, fixed origins, bounds, audits, schema validation, and provider permissions still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "teams_and_mcp_tools", label: "Connected Guru teams, OAuth refresh, and typed MCP capability check" }],
};
