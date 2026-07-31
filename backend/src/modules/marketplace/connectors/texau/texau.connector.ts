import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const classify = [action("texau_email_type_identify", "Identify email type", "Classify one exact email address with TexAu while returning only privacy-redacted category flags.")];
const blockedActions = [
  blocked("texau_enrichment", "Run enrichment or search", "Email, phone, person, company, profile, lead, web, social, search, scraping, AI, and waterfall enrichment actions are outside V1."),
  blocked("texau_automation", "Run automations", "Tables, workflows, schedules, CRM synchronization, outbound sequences, writes, webhooks, and other automations are outside V1."),
  blocked("texau_private_output", "Expose private results", "Input email addresses, usernames, guessed names, provider-returned contact data, execution logs, provider traces, and raw responses are never returned."),
  blocked("texau_raw_api", "Call arbitrary APIs", "Raw REST, MCP, CLI, another action, origin, path, method, header, payload, key, or integration is outside V1."),
  blocked("texau_bulk_async", "Run bulk or async work", "Bulk inputs, automatic pagination, polling, inquiry endpoints, retries, crawling, streaming, uploads, downloads, and exports are outside V1."),
];
const email = { type: "string", format: "email", minLength: 3, maxLength: 254 };
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const TEXAU_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "texau", name: "TexAu", connectorType: "native_clawchat", providerDocsUrl: "https://www.texau.com/api-platform", providerWebsiteUrl: "https://www.texau.com/",
  capabilities: [{ ...capability("email_type_classification", "Identify email type", "Classify one exact email address and return only bounded privacy-redacted category flags.", true), platformCapability: "texau_email_type_classification" }],
  auth: { type: "api_key", credentialSchema: [{ name: "TEXAU_API_KEY", label: "TexAu API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated action-scoped TexAu API key. Relay stores it encrypted and sends it only in the x-api-key header." }] },
  tools: [{ name: "texau.identifyEmailType", functionName: "texau_email_type_identify", aliases: ["texau.identifyEmailType", "texau_email_type_identify"], capability: "email_type_classification", platformCapability: "texau_email_type_classification", action: "read", approvalRequired: true, description: "Classify one exact email address without returning the address or guessed identity.", inputSchema: { type: "object", required: ["email"], properties: { email, approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "texau_safe", label: "Safe", description: "Each privacy-sensitive, potentially credit-consuming classification requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: classify, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected classifier runs without Relay per-action approval while fixed endpoint, schema, credit, audit, privacy-redaction, and response bounds remain enforced.", defaultSelected: false, allowedActions: classify, approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "configuration", label: "TexAu encrypted API key configuration; live validation occurs only in an approved action" }],
};
