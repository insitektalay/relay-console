import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [action("lemlist_campaign_status_get", "Read campaign status", "Read one bounded privacy-redacted status summary for the exact configured lemlist campaign ID.")];
const blockedActions = [
  blocked("lemlist_campaign_mutation", "Change campaigns", "Creating, updating, deleting, launching, pausing, archiving, scheduling, sequencing, or changing senders for campaigns is outside V1."),
  blocked("lemlist_people_messaging", "Access people or messages", "Leads, contacts, email addresses, replies, inboxes, messages, sends, unsubscribes, and other person-level or communication data are outside V1."),
  blocked("lemlist_enrichment_ai", "Run enrichment or AI", "Enrichment, phone or LinkedIn discovery, data credits, research, personalization, and AI tools are outside V1."),
  blocked("lemlist_private_account", "Read private account data", "Creator and sender identity, mailboxes, teams, users, integrations, errors, labels, variables, CRM fields, detailed statistics, and raw responses are never returned."),
  blocked("lemlist_raw_bulk", "Call raw or bulk surfaces", "Raw REST, MCP, CLI, arbitrary endpoints, list/search/filter queries, pagination, polling, imports, exports, downloads, webhooks, API keys, and bulk work are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const LEMLIST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "lemlist", name: "lemlist", connectorType: "native_clawchat", providerDocsUrl: "https://developer.lemlist.com/api-reference/getting-started/overview", providerWebsiteUrl: "https://www.lemlist.com/",
  capabilities: [{ ...capability("campaign_status_read", "Read campaign status", "Read one bounded privacy-redacted status summary for the exact configured lemlist campaign ID.", true), platformCapability: "lemlist_campaign_status_read" }],
  auth: { type: "api_key", credentialSchema: [
    { name: "LEMLIST_API_KEY", label: "lemlist API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated lemlist API key. Relay stores it encrypted and sends it only as the password in HTTP Basic authentication." },
    { name: "LEMLIST_CAMPAIGN_ID", label: "lemlist campaign ID", required: true, secret: false, storedIn: "metadata", helpText: "Enter the exact permanent cam_ campaign ID to bind. V1 cannot list campaigns, access leads, or send messages." },
  ] },
  tools: [{ name: "lemlist.getCampaignStatus", functionName: "lemlist_campaign_status_get", aliases: ["lemlist.getCampaignStatus", "lemlist_campaign_status_get"], capability: "campaign_status_read", platformCapability: "lemlist_campaign_status_read", action: "read", approvalRequired: true, description: "Read the bounded privacy-redacted status of the exact configured campaign.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "lemlist_safe", label: "Safe", description: "The bounded private campaign status read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected status read runs without Relay approval while exact campaign binding, fixed endpoint, audit, redaction, and response bounds remain enforced; people, messaging, enrichment, and writes stay blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "campaign", label: "lemlist API key and exact campaign ID validation" }],
};
