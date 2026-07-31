import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [action("evaboot_quota_get", "Read quota summary", "Read bounded account quota, credit, and aggregate Sales Navigator connection status without account identifiers.")];
const blockedActions = [
  blocked("evaboot_extraction", "Extract LinkedIn data", "Sales Navigator searches, lists, profiles, companies, URLs, and single or bulk extraction jobs are outside V1."),
  blocked("evaboot_email_data", "Find or verify emails", "Email finding, verification, enrichment, contact/prospect data, job results, and professional identity data are outside V1."),
  blocked("evaboot_search_automation", "Build searches or automate jobs", "Search Builder, job creation, retries, schedules, webhook delivery, and other automation are outside V1."),
  blocked("evaboot_private_account", "Read private account data", "Sales Navigator account IDs, user identity, job history, prospect records, provider traces, and raw responses are never returned."),
  blocked("evaboot_raw_bulk", "Call raw or bulk surfaces", "Raw REST, MCP, CLI, arbitrary endpoints, bulk inputs, polling, pagination, crawling, downloads, and exports are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
export const EVABOOT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "evaboot", name: "Evaboot", connectorType: "native_clawchat", providerDocsUrl: "https://docs.evaboot.com/schema", providerWebsiteUrl: "https://evaboot.com/",
  capabilities: [{ ...capability("quota_read", "Read quota summary", "Read bounded daily quota, available credits, and aggregate Sales Navigator connection status.", true), platformCapability: "evaboot_quota_read" }],
  auth: { type: "api_key", credentialSchema: [{ name: "EVABOOT_API_TOKEN", label: "Evaboot API token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated Evaboot API token. Relay stores it encrypted and sends it only as a Bearer token." }] },
  tools: [{ name: "evaboot.getQuota", functionName: "evaboot_quota_get", aliases: ["evaboot.getQuota", "evaboot_quota_get"], capability: "quota_read", platformCapability: "evaboot_quota_read", action: "read", approvalRequired: true, description: "Read a privacy-redacted quota and connected-account count summary.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "evaboot_safe", label: "Safe", description: "The private account quota read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected quota read runs without Relay per-action approval while fixed endpoint, audit, redaction, and response bounds remain enforced.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "quota", label: "Evaboot API token and quota endpoint validation" }],
};
