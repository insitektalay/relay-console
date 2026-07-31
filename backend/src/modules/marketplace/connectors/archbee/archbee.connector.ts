import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("archbee_get_document", "Read document", "Read one document in a documented format."),
  action("archbee_search_documents", "Search documents", "Run bounded non-persistent word search in the connected DocSpace."),
];
const writes = [
  action("archbee_upload_file", "Upload file", "Upload one bounded supported file; Safe mode requires approval."),
  action("archbee_full_api", "Use full Public API", "Use any documented Archbee Public API operation; Safe mode requires approval."),
];

export const ARCHBEE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "archbee",
  name: "Archbee",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.archbee.com/docs/public-api",
  providerWebsiteUrl: "https://www.archbee.com/",
  capabilities: [
    { ...capability("knowledge_read", "Read documentation", "Read and search permitted documents in the bound DocSpace.", true), platformCapability: "archbee_knowledge_read" },
    { ...capability("knowledge_write", "Create and maintain documentation", "Create, update, delete, import, publish, clone, sync, upload, and resolve suggested changes.", true), platformCapability: "archbee_knowledge_write" },
    { ...capability("organization_admin", "Manage spaces and organization exports", "Create, update, publish, clone, or delete spaces and groups and export authorized organization data.", true), platformCapability: "archbee_organization_admin" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "ARCHBEE_DOC_SPACE_ID", label: "Archbee DocSpace ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Copy the DocSpace ID paired with the API key." },
      { name: "ARCHBEE_API_KEY", label: "Archbee API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create or copy the customer-owned key for the intended Archbee DocSpace." },
    ],
  },
  tools: [
    { name: "archbee.getDocument", functionName: "archbee_get_document", aliases: ["archbee.getDocument", "archbee_get_document"], capability: "knowledge_read", platformCapability: "archbee_knowledge_read", action: "read", approvalRequired: false, description: "Read one document in markdown, HTML, JSON, or source format.", inputSchema: { type: "object", properties: { docId: { type: "string", maxLength: 200 }, format: { type: "string", enum: ["markdown", "html", "json", "source"] } }, required: ["docId"], additionalProperties: false } },
    { name: "archbee.searchDocuments", functionName: "archbee_search_documents", aliases: ["archbee.searchDocuments", "archbee_search_documents"], capability: "knowledge_read", platformCapability: "archbee_knowledge_read", action: "read", approvalRequired: false, description: "Run bounded non-persistent word search.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 2000 }, searchOnlyTitle: { type: "boolean" }, dataTextFormat: { type: "string", enum: ["markdown", "html"] }, parentDocId: { type: "string", maxLength: 200 } }, required: ["query"], additionalProperties: false } },
    { name: "archbee.uploadFile", functionName: "archbee_upload_file", aliases: ["archbee.uploadFile", "archbee_upload_file"], capability: "knowledge_write", platformCapability: "archbee_knowledge_write", action: "write", approvalRequired: true, description: "Upload one bounded JSON, YAML, or ZIP file to File Manager.", inputSchema: { type: "object", properties: { filename: { type: "string", maxLength: 200 }, fileBase64: { type: "string", maxLength: 7000000 }, isPublic: { type: "boolean" }, approvalId: { type: "string" } }, required: ["filename", "fileBase64"], additionalProperties: false } },
    { name: "archbee.request", functionName: "archbee_request", aliases: ["archbee.request", "archbee_request", "archbee_full_api"], capability: "organization_admin", platformCapability: "archbee_organization_admin", action: "admin", approvalRequired: true, description: "Call any documented fixed-origin Archbee Public API operation.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "DELETE"] }, path: { type: "string", pattern: "^/api/public-api/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "archbee_safe", label: "Safe", description: "Single-document reads and non-persistent word searches run directly; uploads and every broader or mutating API operation require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected API-key-authorized Archbee operation runs without Relay per-action approval; ownership, fixed origin, bounds, audits, redaction, and provider authority still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "word_search", label: "Archbee DocSpace bearer-key validation" }],
};
