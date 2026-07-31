import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [action("woodpecker_campaign_status_get", "Read campaign status", "Read one bounded privacy-redacted status summary for the exact configured Woodpecker campaign ID.")];
const blockedActions = [
  blocked("woodpecker_campaign_mutation", "Change or run campaigns", "Creating, editing, running, pausing, stopping, deleting, scheduling, sequencing, or changing campaign settings and accounts is outside V1."),
  blocked("woodpecker_prospect_messaging", "Access prospects or messages", "Prospects, leads, contacts, email addresses, LinkedIn profiles, inboxes, replies, manual tasks, sent activity, and person-level data are outside V1."),
  blocked("woodpecker_private_content", "Read private campaign content", "Mailbox and LinkedIn account IDs, delivery schedules, subjects, message bodies, variants, snippets, tracking, settings, and raw responses are never returned."),
  blocked("woodpecker_account_automation", "Access account or automation surfaces", "Mailboxes, LinkedIn accounts, users, domains, agency/client impersonation, master keys, webhooks, reports, Lead Finder, and administration are outside V1."),
  blocked("woodpecker_raw_bulk", "Call raw or bulk surfaces", "Raw REST, MCP, CLI, arbitrary endpoints, list/search/filter queries, pagination, polling, imports, bulk work, downloads, exports, and crawling are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const WOODPECKER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "woodpecker", name: "Woodpecker", connectorType: "native_clawchat", providerDocsUrl: "https://developers.woodpecker.co/docs/", providerWebsiteUrl: "https://woodpecker.co/",
  capabilities: [{ ...capability("campaign_status_read", "Read campaign status", "Read one bounded privacy-redacted status summary for the exact configured Woodpecker campaign ID.", true), platformCapability: "woodpecker_campaign_status_read" }],
  auth: { type: "api_key", credentialSchema: [
    { name: "WOODPECKER_API_KEY", label: "Woodpecker API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated API key for the intended non-agency account. Relay stores it encrypted and sends it only in the x-api-key header." },
    { name: "WOODPECKER_CAMPAIGN_ID", label: "Woodpecker campaign ID", required: true, secret: false, storedIn: "metadata", helpText: "Enter the exact positive numeric campaign ID to bind. V1 cannot list campaigns, access sequences or prospects, or send messages." },
  ] },
  tools: [{ name: "woodpecker.getCampaignStatus", functionName: "woodpecker_campaign_status_get", aliases: ["woodpecker.getCampaignStatus", "woodpecker_campaign_status_get"], capability: "campaign_status_read", platformCapability: "woodpecker_campaign_status_read", action: "read", approvalRequired: true, description: "Read the bounded privacy-redacted status of the exact configured campaign.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "woodpecker_safe", label: "Safe", description: "The bounded private campaign status read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected status read runs without Relay approval while exact campaign binding, fixed endpoint, audit, redaction, and response bounds remain enforced; prospects, messaging, campaign writes, and account automation stay blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "campaign", label: "Woodpecker API key and exact campaign ID validation" }],
};
