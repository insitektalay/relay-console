import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("feedly_read_profile", "Read profile", "Read the authenticated Feedly profile."),
  action("feedly_list_team_folders", "List team folders", "List the authenticated team's folders."),
  action("feedly_collect_articles", "Collect articles", "Collect a bounded page from a selected Feedly stream."),
];
const writes = [action("feedly_full_api", "Use full Feedly API", "Use any documented Feedly v3 operation; Safe mode requires approval.")];

export const FEEDLY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "feedly",
  name: "Feedly",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.feedly.com/reference/introduction",
  providerWebsiteUrl: "https://feedly.com/",
  capabilities: [
    { ...capability("intelligence_read", "Read intelligence", "Read the profile, team folders, and bounded pages from selected AI Feed, folder, or board streams.", true), platformCapability: "feedly_intelligence_read" },
    { ...capability("full_api", "Full Feedly API", "Use the complete documented v3 API authorized by the customer's Enterprise token.", true), platformCapability: "feedly_full_api" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [{ name: "FEEDLY_ACCESS_TOKEN", label: "Feedly Enterprise API access token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Generate a token from your own Feedly Enterprise team's API self-service page. Railway encrypts it and sends it only to api.feedly.com." }],
  },
  tools: [
    { name: "feedly.getProfile", functionName: "feedly_get_profile", aliases: ["feedly.getProfile", "feedly_get_profile"], capability: "intelligence_read", platformCapability: "feedly_intelligence_read", action: "read", approvalRequired: false, description: "Read the authenticated Feedly profile.", inputSchema: empty() },
    { name: "feedly.listTeamFolders", functionName: "feedly_list_team_folders", aliases: ["feedly.listTeamFolders", "feedly_list_team_folders"], capability: "intelligence_read", platformCapability: "feedly_intelligence_read", action: "read", approvalRequired: false, description: "List Feedly team folders and their feeds.", inputSchema: empty() },
    { name: "feedly.collectArticles", functionName: "feedly_collect_articles", aliases: ["feedly.collectArticles", "feedly_collect_articles"], capability: "intelligence_read", platformCapability: "feedly_intelligence_read", action: "read", approvalRequired: false, description: "Collect up to 100 articles from one selected stream.", inputSchema: { type: "object", properties: { streamId: { type: "string", maxLength: 2000 }, count: { type: "number", minimum: 1, maximum: 100 }, newerThan: { type: "number" }, olderThan: { type: "number" }, continuation: { type: "string", maxLength: 2000 }, includeAiActions: { type: "boolean" } }, required: ["streamId"], additionalProperties: false } },
    { name: "feedly.request", functionName: "feedly_request", aliases: ["feedly.request", "feedly_request", "feedly_full_api"], capability: "full_api", platformCapability: "feedly_full_api", action: "admin", approvalRequired: true, description: "Call any documented api.feedly.com /v3 endpoint. Absolute URLs and credential-bearing fields are rejected.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/v3/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "feedly_safe", label: "Safe", description: "Bounded profile, folder, and article reads run directly; every other API operation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected token-authorized operation runs without Relay per-action approval; ownership, token authority, fixed origin, bounds, audits, provider terms, and rate limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "profile", label: "Feedly token and profile check" }],
};

function empty() { return { type: "object", properties: {}, additionalProperties: false }; }
