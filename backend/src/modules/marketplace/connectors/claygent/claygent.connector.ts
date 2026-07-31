import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [action("claygent_workspace_get", "Read connected workspace", "Validate the exact Clay API-key-bound workspace for future Claygent setup without returning personal identity, agent configuration, prompts, sources, outputs, or GTM data.")];
const blockedActions = [
  blocked("claygent_run", "Run Claygent research", "Claygent execution, testing, deployment, prompts, model selection, browsing, research, classification, scoring, copywriting, and credit or Action consumption are outside V1 because no stable Claygent-specific Public API contract is documented."),
  blocked("claygent_private_configuration", "Read private Claygent configuration", "Agents, prompts, business context, documents, connected sources, provider connections, production data, outputs, citations, histories, and evaluations are outside V1."),
  blocked("claygent_mutation", "Change Claygents", "Building, editing, testing, deploying, sharing, or deleting Claygents, Functions, Workflows, tables, or integrations is outside V1."),
  blocked("claygent_raw_surface", "Call arbitrary Clay surfaces", "Routines, Workflows Alpha, Searches, Tables, raw Public API, MCP, CLI, plugin, arbitrary paths, methods, payloads, and undocumented Claygent endpoints are outside V1."),
  blocked("claygent_bulk_export", "Export Claygent data", "Batch runs, uploads, webhooks, polling, pagination, crawling, synchronization, downloads, and exports are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
export const CLAYGENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "claygent", name: "Claygent", connectorType: "native_clawchat", providerDocsUrl: "https://university.clay.com/docs/claygent-builder", providerWebsiteUrl: "https://www.clay.com/claygent",
  capabilities: [{ ...capability("workspace_read", "Read connected workspace", "Validate the exact API-key-bound Clay workspace before external Claygent setup.", true), platformCapability: "claygent_workspace_read" }],
  auth: { type: "api_key", credentialSchema: [{ name: "CLAYGENT_PUBLIC_API_KEY", label: "Clay Public API key for Claygent", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a personal Clay Public API key. Relay stores it encrypted and sends it only to the stable GET /public/v0/me endpoint; Claygent execution is not enabled." }] },
  tools: [{ name: "claygent.getWorkspace", functionName: "claygent_workspace_get", aliases: ["claygent.getWorkspace", "claygent_workspace_get"], capability: "workspace_read", platformCapability: "claygent_workspace_read", action: "read", approvalRequired: true, description: "Validate the bounded Clay workspace binding for external Claygent setup.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "claygent_safe", label: "Safe", description: "The bounded private workspace-binding read requires matching approval; Claygent execution remains blocked.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The workspace-binding read runs without Relay approval, but Claygent execution and every unstable, private, mutating, credit-consuming, raw, bulk, or export surface remain hard-blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "workspace", label: "Clay Public API key and exact workspace validation for Claygent setup" }],
};
