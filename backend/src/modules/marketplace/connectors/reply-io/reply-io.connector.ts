import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [action("reply_io_sequence_status_get", "Read sequence status", "Read one bounded privacy-redacted status summary for the exact configured Reply.io sequence ID.")];
const blockedActions = [
  blocked("reply_io_sequence_mutation", "Change or run sequences", "Creating, updating, archiving, deleting, starting, pausing, scheduling, sequencing, or changing sending accounts and settings is outside V1."),
  blocked("reply_io_people_messaging", "Access people or messages", "Contacts, lists, email addresses, LinkedIn profiles, inboxes, replies, calls, SMS, WhatsApp, tasks, sends, and person-level state are outside V1."),
  blocked("reply_io_private_content", "Read private sequence content", "Team and owner IDs, sending-account IDs, schedules, steps, subjects, bodies, templates, variants, attachments, settings, and raw responses are never returned."),
  blocked("reply_io_ai_admin", "Access AI or administration", "AI SDR, enrichment, email validation, custom fields, blacklists, accounts, users, holiday calendars, reports, webhooks, background jobs, and administration are outside V1."),
  blocked("reply_io_raw_bulk", "Call raw or bulk surfaces", "Raw REST, MCP, CLI, OpenAPI pass-through, arbitrary endpoints, list/search/filter queries, pagination, polling, imports, bulk work, downloads, exports, and crawling are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const REPLY_IO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "reply-io", name: "Reply.io", connectorType: "native_clawchat", providerDocsUrl: "https://docs.reply.io/api-reference/introduction", providerWebsiteUrl: "https://reply.io/",
  capabilities: [{ ...capability("sequence_status_read", "Read sequence status", "Read one bounded privacy-redacted status summary for the exact configured Reply.io sequence ID.", true), platformCapability: "reply_io_sequence_status_read" }],
  auth: { type: "api_key", credentialSchema: [
    { name: "REPLY_IO_API_KEY", label: "Reply.io API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated read-scoped V3 API key. Relay stores it encrypted and sends it only in the X-API-Key header for the fixed sequence endpoint." },
    { name: "REPLY_IO_SEQUENCE_ID", label: "Reply.io sequence ID", required: true, secret: false, storedIn: "metadata", helpText: "Enter the exact positive numeric sequence ID to bind. V1 cannot list sequences, access steps or contacts, or send messages." },
  ] },
  tools: [{ name: "replyIo.getSequenceStatus", functionName: "reply_io_sequence_status_get", aliases: ["replyIo.getSequenceStatus", "reply_io_sequence_status_get"], capability: "sequence_status_read", platformCapability: "reply_io_sequence_status_read", action: "read", approvalRequired: true, description: "Read the bounded privacy-redacted status of the exact configured sequence.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "reply_io_safe", label: "Safe", description: "The bounded private sequence status read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected status read runs without Relay approval while exact sequence binding, fixed endpoint, audit, redaction, and response bounds remain enforced; people, messaging, sequence writes, AI, and administration stay blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "sequence", label: "Reply.io API key and exact sequence ID validation" }],
};
