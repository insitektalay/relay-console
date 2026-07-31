import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [action("mixmax_sequence_summary_get", "Read sequence summary", "Read one bounded privacy-redacted summary for the exact configured Mixmax sequence ID.")];
const blockedActions = [
  blocked("mixmax_sequence_mutation", "Change or run sequences", "Creating, updating, deleting, sharing, moving, activating, cancelling, scheduling, or changing sequences, stages, folders, and settings is outside V1."),
  blocked("mixmax_recipient_messaging", "Access recipients or messages", "Recipients, contacts, email addresses, message bodies, drafts, templates, snippets, inboxes, live-feed events, sends, replies, calls, and person-level state are outside V1."),
  blocked("mixmax_private_content", "Read private sequence content", "Owner and team IDs, stages, subjects, bodies, variables, CC/BCC recipients, tracking, connected CRMs, schedules, and raw responses are never returned."),
  blocked("mixmax_account_integrations", "Access account or integrations", "Users, teams, calendars, appointment links, Salesforce, Google or Microsoft integrations, webhooks, reports, billing, and administration are outside V1."),
  blocked("mixmax_raw_bulk", "Call raw or bulk surfaces", "Raw REST, SDK, CLI, arbitrary endpoints, list/search/filter queries, pagination, polling, imports, bulk work, downloads, exports, and crawling are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const MIXMAX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mixmax", name: "Mixmax", connectorType: "native_clawchat", providerDocsUrl: "https://developer.mixmax.com/reference/getting-started-with-the-api", providerWebsiteUrl: "https://www.mixmax.com/",
  capabilities: [{ ...capability("sequence_summary_read", "Read sequence summary", "Read one bounded privacy-redacted summary for the exact configured Mixmax sequence ID.", true), platformCapability: "mixmax_sequence_summary_read" }],
  auth: { type: "api_key", credentialSchema: [
    { name: "MIXMAX_API_TOKEN", label: "Mixmax API token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated developer token in Mixmax Settings > Integrations. Relay stores it encrypted and sends it only in the X-API-Token header." },
    { name: "MIXMAX_SEQUENCE_ID", label: "Mixmax sequence ID", required: true, secret: false, storedIn: "metadata", helpText: "Enter the exact 24-character hexadecimal sequence ID to bind. V1 cannot list sequences, access stages or recipients, or send messages." },
  ] },
  tools: [{ name: "mixmax.getSequenceSummary", functionName: "mixmax_sequence_summary_get", aliases: ["mixmax.getSequenceSummary", "mixmax_sequence_summary_get"], capability: "sequence_summary_read", platformCapability: "mixmax_sequence_summary_read", action: "read", approvalRequired: true, description: "Read the bounded privacy-redacted summary of the exact configured sequence.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "mixmax_safe", label: "Safe", description: "The bounded private sequence summary read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected summary read runs without Relay approval while exact sequence binding, fixed endpoint, audit, redaction, and response bounds remain enforced; recipients, messaging, sequence writes, and integrations stay blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "sequence", label: "Mixmax API token and exact sequence ID validation" }],
};
