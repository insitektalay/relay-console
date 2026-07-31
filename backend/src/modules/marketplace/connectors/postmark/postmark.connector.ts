import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("postmark_read_server", "Read server", "Read bounded metadata for the token's Postmark server."),
  action("postmark_read_streams", "Read message streams", "List bounded message-stream metadata."),
  action("postmark_read_stats", "Read statistics", "Read bounded outbound delivery statistics."),
];
const writes = [
  action("postmark_send_email", "Send email", "Sending email requires approval in Safe mode."),
  action("postmark_full_api", "Use full Postmark API", "Any other Postmark API operation requires approval in Safe mode."),
];

export const POSTMARK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "postmark",
  name: "Postmark",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://postmarkapp.com/developer/api/overview",
  providerWebsiteUrl: "https://postmarkapp.com",
  capabilities: [
    { ...capability("server", "Server", "Read bounded metadata for the connected Postmark server.", true), platformCapability: "email_server_status" },
    { ...capability("message_streams", "Message streams", "List server message streams.", true), platformCapability: "email_message_streams" },
    { ...capability("stats", "Delivery statistics", "Read bounded outbound delivery statistics.", true), platformCapability: "email_delivery_metrics" },
    { ...capability("send", "Send email", "Send through the bound sender and message stream.", true), platformCapability: "email_send" },
    { ...capability("full_api", "Full Postmark API", "Use all Postmark server-token APIs and optional account-token APIs within the connection authority.", false), platformCapability: "postmark_full_api" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "POSTMARK_SERVER_TOKEN", label: "Postmark server token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "The token for the exact Postmark server agents may use." },
      { name: "POSTMARK_ACCOUNT_TOKEN", label: "Postmark account token", required: false, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Optional. Add only if agents need selected account-level server, sender, or domain administration." },
      { name: "POSTMARK_SENDER_BOUNDARY", label: "Sender boundary", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "An exact confirmed sender email or verified domain." },
      { name: "POSTMARK_MESSAGE_STREAM", label: "Message stream", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "The exact transactional or broadcast MessageStream ID agents may use." },
    ],
  },
  tools: [
    { name: "postmark.getServer", functionName: "postmark_get_server", aliases: ["postmark.getServer", "postmark_get_server"], capability: "server", platformCapability: "email_server_status", action: "read", approvalRequired: false, description: "Read bounded metadata for the connected Postmark server; API token values are always redacted.", inputSchema: emptySchema() },
    { name: "postmark.listMessageStreams", functionName: "postmark_list_message_streams", aliases: ["postmark.listMessageStreams", "postmark_list_message_streams"], capability: "message_streams", platformCapability: "email_message_streams", action: "read", approvalRequired: false, description: "List a bounded page of Postmark message streams.", inputSchema: emptySchema() },
    { name: "postmark.getOutboundStats", functionName: "postmark_get_outbound_stats", aliases: ["postmark.getOutboundStats", "postmark_get_outbound_stats"], capability: "stats", platformCapability: "email_delivery_metrics", action: "read", approvalRequired: false, description: "Read bounded Postmark outbound statistics.", inputSchema: { type: "object", properties: { fromDate: { type: "string" }, toDate: { type: "string" }, tag: { type: "string" } }, additionalProperties: false } },
    { name: "postmark.sendEmail", functionName: "postmark_send_email", aliases: ["postmark.sendEmail", "postmark_send_email", "email_send"], capability: "send", platformCapability: "email_send", action: "write", approvalRequired: true, description: "Send an approved Postmark Email API payload through the bound sender and MessageStream.", inputSchema: { type: "object", properties: { message: { type: "object" }, approvalId: { type: "string" } }, required: ["message"], additionalProperties: false } },
    { name: "postmark.request", functionName: "postmark_request", aliases: ["postmark.request", "postmark_request", "postmark_full_api"], capability: "full_api", platformCapability: "postmark_full_api", action: "admin", approvalRequired: true, description: "Call a Postmark API endpoint at the fixed origin with server or optional account authority. Credential-bearing fields are rejected.", inputSchema: { type: "object", properties: { authority: { type: "string", enum: ["server", "account"], default: "server" }, method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: ["object", "array"] }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [{ id: "postmark_safe", label: "Safe", description: "Bounded reads run directly; sends and every other API operation require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] }],
  healthChecks: [{ id: "server", label: "Postmark server check" }],
};

function emptySchema() { return { type: "object", properties: {}, additionalProperties: false }; }
