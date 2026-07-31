import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("resend_read_emails", "Read sent emails", "List bounded sent-email metadata."),
  action("resend_read_domains", "Read domains", "List bounded domain metadata."),
];
const writes = [
  action("resend_send_email", "Send email", "Sending email requires approval in Safe mode."),
  action("resend_send_batch", "Send email batch", "Sending a batch requires approval in Safe mode."),
  action("resend_full_api", "Use full Resend API", "Any other Resend API operation requires approval in Safe mode."),
];

export const RESEND_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "resend", name: "Resend", connectorType: "native_clawchat",
  providerDocsUrl: "https://resend.com/docs/api-reference/introduction", providerWebsiteUrl: "https://resend.com",
  capabilities: [
    { ...capability("emails", "Sent emails", "Read bounded sent-email metadata with a Full access key.", true), platformCapability: "email_delivery_activity" },
    { ...capability("domains", "Domains", "Read bounded sending-domain metadata with a Full access key.", true), platformCapability: "email_sender_identities" },
    { ...capability("send", "Send email", "Send through the configured verified domain.", true), platformCapability: "email_send" },
    { ...capability("batch_send", "Batch send", "Send up to 100 messages through the configured domain.", false), platformCapability: "email_batch_send" },
    { ...capability("full_api", "Full Resend API", "Use all Resend endpoints allowed by the customer-owned key.", false), platformCapability: "resend_full_api" },
  ],
  auth: { type: "api_key", credentialSchema: [
    { name: "RESEND_API_KEY", label: "Resend API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create your own Sending access or Full access key in Resend." },
    { name: "RESEND_KEY_PERMISSION", label: "Key permission", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Enter SENDING or FULL to match the key created in Resend." },
    { name: "RESEND_DOMAIN", label: "Verified sender domain", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "The exact verified domain agents may send from." },
  ] },
  tools: [
    { name: "resend.listEmails", functionName: "resend_list_emails", aliases: ["resend.listEmails", "resend_list_emails"], capability: "emails", platformCapability: "email_delivery_activity", action: "read", approvalRequired: false, description: "List bounded sent-email metadata.", inputSchema: pageSchema() },
    { name: "resend.listDomains", functionName: "resend_list_domains", aliases: ["resend.listDomains", "resend_list_domains"], capability: "domains", platformCapability: "email_sender_identities", action: "read", approvalRequired: false, description: "List bounded domain metadata.", inputSchema: pageSchema() },
    { name: "resend.sendEmail", functionName: "resend_send_email", aliases: ["resend.sendEmail", "resend_send_email", "email_send"], capability: "send", platformCapability: "email_send", action: "write", approvalRequired: true, description: "Send an email through the bound verified domain.", inputSchema: { type: "object", properties: { message: { type: "object" }, idempotencyKey: { type: "string", minLength: 1, maxLength: 256 }, approvalId: { type: "string" } }, required: ["message", "idempotencyKey"], additionalProperties: false } },
    { name: "resend.sendBatch", functionName: "resend_send_batch", aliases: ["resend.sendBatch", "resend_send_batch", "email_batch_send"], capability: "batch_send", platformCapability: "email_batch_send", action: "write", approvalRequired: true, description: "Send 1 to 100 emails through the bound verified domain.", inputSchema: { type: "object", properties: { messages: { type: "array", minItems: 1, maxItems: 100, items: { type: "object" } }, idempotencyKey: { type: "string", minLength: 1, maxLength: 256 }, approvalId: { type: "string" } }, required: ["messages", "idempotencyKey"], additionalProperties: false } },
    { name: "resend.request", functionName: "resend_request", aliases: ["resend.request", "resend_request", "resend_full_api"], capability: "full_api", platformCapability: "resend_full_api", action: "admin", approvalRequired: true, description: "Call a Resend endpoint at the fixed official origin. Caller credentials are rejected.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: ["object", "array"] }, idempotencyKey: { type: "string", minLength: 1, maxLength: 256 }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [{ id: "resend_safe", label: "Safe", description: "Bounded reads run directly; sends and every other API operation require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] }],
  healthChecks: [{ id: "key", label: "Resend API key check" }],
};

function pageSchema() { return { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 100, default: 20 }, after: { type: "string" }, before: { type: "string" } }, additionalProperties: false }; }
