import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [action("clay_workspace_get", "Read connected workspace", "Read bounded workspace and opaque user identifiers for the exact Clay Public API key without returning personal identity or GTM data.")];
const blockedActions = [
  blocked("clay_search_and_enrichment", "Search or enrich GTM data", "Searches, filter discovery, routines, Clay-managed or custom functions, Claygents, Workflows, enrichment, scoring, routing, and credit-consuming runs are outside V1."),
  blocked("clay_private_table_data", "Read private table data", "Enterprise table queries, rows, cells, fields, people, companies, contact details, firmographics, signals, and other workspace content are outside V1."),
  blocked("clay_workspace_mutation", "Change Clay data", "Creating or changing tables, workflows, functions, searches, runs, records, integrations, settings, or other Clay state is outside V1."),
  blocked("clay_raw_api", "Call arbitrary Clay tools", "The raw Public API, MCP server, CLI, plugin, arbitrary origins, paths, methods, parameters, filters, cursors, payloads, and alpha surfaces are outside V1."),
  blocked("clay_bulk_export", "Export Clay data", "Batch runs, uploads, webhooks, polling, automatic pagination, crawling, synchronization, downloads, and exports are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const CLAY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clay", name: "Clay", connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.clay.com/", providerWebsiteUrl: "https://www.clay.com/",
  capabilities: [{ ...capability("workspace_read", "Read connected workspace", "Validate the exact API-key-bound Clay workspace and return only opaque workspace/user identifiers and workspace name.", true), platformCapability: "clay_workspace_read" }],
  auth: { type: "api_key", credentialSchema: [{ name: "CLAY_PUBLIC_API_KEY", label: "Clay Public API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a personal Public API key in Clay's beta API-key settings. Relay stores it encrypted and sends it only in the clay-api-key header to the fixed Public API origin." }] },
  tools: [{ name: "clay.getWorkspace", functionName: "clay_workspace_get", aliases: ["clay.getWorkspace", "clay_workspace_get"], capability: "workspace_read", platformCapability: "clay_workspace_read", action: "read", approvalRequired: true, description: "Read the bounded API-key-bound Clay workspace summary.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "clay_safe", label: "Safe", description: "The bounded private workspace-binding read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected workspace-binding read runs without Relay per-action approval while exact key authority, fixed origin and endpoint, audit, redaction, response bounds, and provider limits remain enforced.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "workspace", label: "Clay Public API key and exact workspace validation" }],
};
