import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [action("cirrus_insight_scheduling_links_get", "Read scheduling links", "Read at most ten bounded scheduling-link summaries for the exact encrypted Cirrus Insight user email.")];
const blockedActions = [
  blocked("cirrus_insight_meeting_mutation", "Change meetings or outreach", "Booking, rescheduling, canceling, routing, emailing, blasting, following up, changing campaigns, and other external actions are outside V1."),
  blocked("cirrus_insight_people_content", "Access people or content", "Invitee identity, email addresses, form questions and answers, contacts, leads, messages, subjects, bodies, attachments, and engagement data are outside V1."),
  blocked("cirrus_insight_private_calendar", "Access private calendar data", "Availability, calendar events, meeting IDs, conferencing details, owners, attendees, internal calendar identifiers, and raw calendar data are outside V1."),
  blocked("cirrus_insight_org_webhook_admin", "Access organization or webhooks", "Organization settings and profiles, users, teams, service accounts, domains, Salesforce sync, webhook events/endpoints/logs/signing keys, and administration are outside V1."),
  blocked("cirrus_insight_raw_bulk", "Call raw or bulk surfaces", "Raw REST, arbitrary endpoints, multiple or caller-supplied emails, polling, event streams, imports, bulk work, downloads, exports, and crawling are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const CIRRUS_INSIGHT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cirrus-insight", name: "Cirrus Insight", connectorType: "native_clawchat", providerDocsUrl: "https://docs.cirrusinsight.com/developer/apis/scheduling-links.html", providerWebsiteUrl: "https://www.cirrusinsight.com/",
  capabilities: [{ ...capability("scheduling_links_read", "Read scheduling links", "Read at most ten bounded scheduling-link summaries for the exact encrypted Cirrus Insight user email.", true), platformCapability: "cirrus_insight_scheduling_links_read" }],
  auth: { type: "custom", credentialSchema: [
    { name: "CIRRUS_INSIGHT_ORGANIZATION_ID", label: "Cirrus Insight organization ID", required: true, secret: true, storedIn: "encrypted_secret", helpText: "After Cirrus Insight enables the Scheduling Links API, enter the issued organization UUID. Relay encrypts it because the documented endpoint publishes no separate request credential." },
    { name: "CIRRUS_INSIGHT_USER_EMAIL", label: "Cirrus Insight user email", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Enter one exact Cirrus Insight user email to bind. Relay encrypts it and never permits caller-supplied or multi-user lookup." },
  ] },
  tools: [{ name: "cirrusInsight.getSchedulingLinks", functionName: "cirrus_insight_scheduling_links_get", aliases: ["cirrusInsight.getSchedulingLinks", "cirrus_insight_scheduling_links_get"], capability: "scheduling_links_read", platformCapability: "cirrus_insight_scheduling_links_read", action: "read", approvalRequired: true, description: "Read at most ten bounded scheduling-link names, HTTPS URLs, and primary flags for the exact configured user.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "cirrus_insight_safe", label: "Safe", description: "The bounded private scheduling-link read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected scheduling-link read runs without Relay approval while exact organization/user binding, fixed endpoint, audit, redaction, and response bounds remain enforced; meeting, people, calendar, webhook, organization, and write surfaces stay blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "scheduling_links", label: "Cirrus Insight organization, user, and Scheduling Links API validation" }],
};
