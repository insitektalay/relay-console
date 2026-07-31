import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("readme_get_project", "Read project", "Verify and describe the connected ReadMe project."),
  action("readme_list_branches", "List branches", "List a bounded page of documentation versions and branches."),
  action("readme_search", "Search documentation", "Search a bounded page across the connected project."),
];
const writes = [
  action("readme_upload_image", "Upload image", "Upload one bounded image to the connected ReadMe project; Safe mode requires approval."),
  action("readme_full_api", "Use full ReadMe API", "Use any documented ReadMe API v2 operation; Safe mode requires approval."),
];

export const README_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "readme",
  name: "ReadMe",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.readme.com/main/reference/intro-to-the-readme-api",
  providerWebsiteUrl: "https://readme.com/",
  capabilities: [
    { ...capability("docs_read", "Read documentation", "Read project metadata, branches, and bounded cross-project search results.", true), platformCapability: "readme_docs_read" },
    { ...capability("full_api", "Full ReadMe API", "Create, update, publish, organize, and delete documentation, API definitions, changelogs, recipes, images, branches, projects, and API keys through API v2.", true), platformCapability: "readme_full_api" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "README_API_KEY", label: "ReadMe project API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Generate a dedicated key under ReadMe Configuration > API Keys. Railway stores it encrypted and sends it only to api.readme.com." },
    ],
  },
  tools: [
    { name: "readme.getProject", functionName: "readme_get_project", aliases: ["readme.getProject", "readme_get_project"], capability: "docs_read", platformCapability: "readme_docs_read", action: "read", approvalRequired: false, description: "Read connected-project metadata.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "readme.listBranches", functionName: "readme_list_branches", aliases: ["readme.listBranches", "readme_list_branches"], capability: "docs_read", platformCapability: "readme_docs_read", action: "read", approvalRequired: false, description: "List bounded documentation branches.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 1000 }, perPage: { type: "number", minimum: 1, maximum: 100 } }, additionalProperties: false } },
    { name: "readme.search", functionName: "readme_search", aliases: ["readme.search", "readme_search"], capability: "docs_read", platformCapability: "readme_docs_read", action: "read", approvalRequired: false, description: "Search a bounded page across the connected project.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 1000 }, section: { type: "string", enum: ["guides", "reference", "recipes", "custom_pages", "discuss", "changelog"] }, version: { type: "string", maxLength: 200 }, page: { type: "number", minimum: 1, maximum: 1000 }, perPage: { type: "number", minimum: 1, maximum: 50 } }, required: ["query"], additionalProperties: false } },
    { name: "readme.uploadImage", functionName: "readme_upload_image", aliases: ["readme.uploadImage", "readme_upload_image"], capability: "full_api", platformCapability: "readme_full_api", action: "write", approvalRequired: true, description: "Upload one bounded image as multipart data.", inputSchema: { type: "object", properties: { filename: { type: "string", maxLength: 200 }, mimeType: { type: "string", enum: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"] }, fileBase64: { type: "string", maxLength: 7000000 }, resizeHeight: { type: "number", minimum: 1, maximum: 10000 }, approvalId: { type: "string" } }, required: ["filename", "mimeType", "fileBase64"], additionalProperties: false } },
    { name: "readme.request", functionName: "readme_request", aliases: ["readme.request", "readme_request", "readme_full_api"], capability: "full_api", platformCapability: "readme_full_api", action: "admin", approvalRequired: true, description: "Call any documented api.readme.com /v2 endpoint. Absolute URLs and credential-bearing fields are rejected and returned API-key tokens are redacted.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PATCH", "PUT", "DELETE"] }, path: { type: "string", pattern: "^/v2/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "readme_safe", label: "Safe", description: "Bounded project, branch, and search reads run directly; uploads and every other API operation require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected API-key-authorized ReadMe operation runs without Relay per-action approval; ownership, fixed origin, bounds, audits, secret non-exposure, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "project_metadata", label: "ReadMe project API-key validation" }],
};
