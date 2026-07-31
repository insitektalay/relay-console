import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [action("phantombuster_agent_status_get", "Read Phantom status", "Read one bounded redacted status summary for the exact configured Phantom/Agent ID.")];
const blockedActions = [
  blocked("phantombuster_agent_run", "Run or stop Phantoms", "Launching, scheduling, retrying, chaining, aborting, or overriding arguments for Phantoms or Workflows is outside V1."),
  blocked("phantombuster_private_output", "Read private outputs", "Console output, messages, runtime events, arguments, saved configuration, cookies, credentials, people/contact data, result objects, files, S3 paths, and download URLs are outside V1."),
  blocked("phantombuster_agent_mutation", "Change Phantoms", "Creating, saving, updating, copying, sharing, or deleting agents, scripts, branches, organizations, or settings is outside V1."),
  blocked("phantombuster_raw_api", "Call arbitrary APIs", "Other agents, containers, origins, API versions, endpoints, methods, headers, query parameters, payloads, scripts, and raw API access are outside V1."),
  blocked("phantombuster_bulk_export", "Export automation data", "Output streaming, polling, automatic pagination, crawling, synchronization, bulk launches, file inputs, webhooks, downloads, and exports are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
export const PHANTOMBUSTER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "phantombuster", name: "PhantomBuster", connectorType: "native_clawchat", providerDocsUrl: "https://hub.phantombuster.com/docs/api", providerWebsiteUrl: "https://phantombuster.com/",
  capabilities: [{ ...capability("agent_status_read", "Read Phantom status", "Read one bounded redacted status summary for the exact configured Phantom/Agent ID.", true), platformCapability: "phantombuster_agent_status_read" }],
  auth: { type: "api_key", credentialSchema: [
    { name: "PHANTOMBUSTER_API_KEY", label: "PhantomBuster API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated Workspace API key. Relay stores it encrypted and sends it only in the X-Phantombuster-Key header." },
    { name: "PHANTOMBUSTER_AGENT_ID", label: "Phantom/Agent ID", required: true, secret: false, storedIn: "metadata", helpText: "Enter the exact permanent numeric Agent ID to bind; V1 cannot launch it or read its output files." },
  ] },
  tools: [{ name: "phantombuster.getAgentStatus", functionName: "phantombuster_agent_status_get", aliases: ["phantombuster.getAgentStatus", "phantombuster_agent_status_get"], capability: "agent_status_read", platformCapability: "phantombuster_agent_status_read", action: "read", approvalRequired: true, description: "Read the bounded redacted status of the exact configured Phantom.", inputSchema: { type: "object", properties: { approvalId }, additionalProperties: false } }],
  approvalProfiles: [
    { id: "phantombuster_safe", label: "Safe", description: "The bounded private Agent status read requires matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The selected status read runs without Relay approval while exact Agent ID, fixed endpoint, audit, redaction, and response bounds remain enforced; launches and output access stay blocked.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ], healthChecks: [{ id: "agent", label: "PhantomBuster API key and exact Agent ID validation" }],
};
