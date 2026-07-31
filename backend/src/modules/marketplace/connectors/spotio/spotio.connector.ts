import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [action("spotio_data_object_summary_get", "Read data-object summary", "Read one bounded privacy-redacted workflow summary for the exact configured SPOTIO data-object ID.")];
const blockedActions = [
  blocked("spotio_data_object_mutation", "Change data objects", "Creating, patching, moving, deleting, restoring, assigning, or changing data objects, fields, stages, pins, activities, appointments, documents, and related records is outside V1."),
  blocked("spotio_people_location_content", "Access people, location, or private content", "Names, phones, emails, addresses, GPS coordinates, place IDs, owners, collaborators, territories, custom fields, notes, attachments, and raw records are never returned."),
  blocked("spotio_communication", "Communicate with prospects", "Calls, email, text, templates, campaigns, autoplays, multichannel communication, signatures, notifications, and prospect outreach are outside V1."),
  blocked("spotio_account_workflow_admin", "Access account or administration", "Users, teams, business cards, workflow definitions, layouts, SSO, connectors, API keys, bearer tokens, webhooks, reports, calendars, routes, trips, tracking, billing, and administration are outside V1."),
  blocked("spotio_raw_bulk", "Call raw or bulk surfaces", "Raw REST, arbitrary endpoints, searches, filters, pagination, polling, exports, imports, bulk jobs, downloads, crawling, and provider MCP surfaces are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const SPOTIO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "spotio", name: "SPOTIO", connectorType: "native_clawchat", providerDocsUrl: "https://developer.spotio2.com/", providerWebsiteUrl: "https://spotio.com/",
  capabilities: [{ ...capability("data_object_summary_read", "Read data-object summary", "Read one bounded privacy-redacted workflow summary for the exact configured SPOTIO data-object ID.", true), platformCapability: "spotio_data_object_summary_read" }],
  auth: { type: "api_key", credentialSchema: [
    { name: "SPOTIO_CLIENT_ID", label: "SPOTIO Client ID", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated API key as a SPOTIO Admin under Settings > Integrations > API Access. Relay stores the Client ID encrypted." },
    { name: "SPOTIO_CLIENT_SECRET", label: "SPOTIO Secret", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Copy the one-time Secret when creating the dedicated API key. Relay stores it encrypted and uses it only to obtain the provider's 30-day bearer token." },
    { name: "SPOTIO_DATA_OBJECT_ID", label: "SPOTIO data-object ID", required: true, secret: false, storedIn: "metadata", helpText: "Enter one exact 24-character hexadecimal data-object ID. V1 cannot search, list, or change data objects." },
  ] },
  tools: [{ name: "spotio.getDataObjectSummary", functionName: "spotio_data_object_summary_get", aliases: ["spotio.getDataObjectSummary", "spotio_data_object_summary_get"], capability: "data_object_summary_read", platformCapability: "spotio_data_object_summary_read", action: "read", approvalRequired: true, description: "Read the bounded privacy-redacted workflow summary of the exact configured data object.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "spotio_safe", label: "Safe", description: "The bounded private data-object summary read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected summary read runs without Relay approval while exact object binding, token exchange, fixed endpoint, audit, redaction, and response bounds remain enforced; people, location, content, communication, writes, administration, and bulk work stay blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "data_object", label: "SPOTIO API keys and exact data-object ID validation" }],
};
