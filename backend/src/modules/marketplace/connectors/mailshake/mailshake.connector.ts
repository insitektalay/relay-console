import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [action("mailshake_campaign_status_get", "Read campaign status", "Read one bounded privacy-redacted status summary for the exact configured Mailshake campaign ID.")];
const blockedActions = [
  blocked("mailshake_campaign_mutation", "Change campaigns", "Creating, pausing, unpausing, archiving, scheduling, sequencing, changing senders, or otherwise mutating campaigns is outside V1."),
  blocked("mailshake_people_messaging", "Access people or messages", "Recipients, leads, contacts, email addresses, sent mail, opens, clicks, replies, unsubscribes, inbox workflows, and other person-level or communication data are outside V1."),
  blocked("mailshake_private_content", "Read private campaign content", "Message subjects or bodies, sequence details, sender identity, connected mailboxes, campaign URLs, text replacements, problems, and raw responses are never returned."),
  blocked("mailshake_team_automation", "Access team or automation surfaces", "Team members, senders, webhooks/push subscriptions, integrations, OAuth administration, API keys, imports, and recipient or lead automation are outside V1."),
  blocked("mailshake_raw_bulk", "Call raw or bulk surfaces", "Raw REST, SDK, arbitrary endpoints, list/search/filter queries, pagination, polling, bulk work, asynchronous jobs, exports, CSV downloads, and crawling are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const MAILSHAKE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mailshake", name: "Mailshake", connectorType: "native_clawchat", providerDocsUrl: "https://api-docs.mailshake.com/", providerWebsiteUrl: "https://mailshake.com/",
  capabilities: [{ ...capability("campaign_status_read", "Read campaign status", "Read one bounded privacy-redacted status summary for the exact configured Mailshake campaign ID.", true), platformCapability: "mailshake_campaign_status_read" }],
  auth: { type: "api_key", credentialSchema: [
    { name: "MAILSHAKE_API_KEY", label: "Mailshake API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated team API key. Relay stores it encrypted and sends it only as the username in HTTP Basic authentication." },
    { name: "MAILSHAKE_CAMPAIGN_ID", label: "Mailshake campaign ID", required: true, secret: false, storedIn: "metadata", helpText: "Enter the exact positive numeric campaign ID to bind. V1 cannot list campaigns, access sequences or people, or send email." },
  ] },
  tools: [{ name: "mailshake.getCampaignStatus", functionName: "mailshake_campaign_status_get", aliases: ["mailshake.getCampaignStatus", "mailshake_campaign_status_get"], capability: "campaign_status_read", platformCapability: "mailshake_campaign_status_read", action: "read", approvalRequired: true, description: "Read the bounded privacy-redacted status of the exact configured campaign.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "mailshake_safe", label: "Safe", description: "The bounded private campaign status read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected status read runs without Relay approval while exact campaign binding, fixed endpoint, audit, redaction, and response bounds remain enforced; people, messaging, campaign writes, and exports stay blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "campaign", label: "Mailshake API key and exact campaign ID validation" }],
};
