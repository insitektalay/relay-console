import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("sendgrid_read_profile", "Read profile", "Read bounded SendGrid account profile metadata."),
  action("sendgrid_read_senders", "Read sender identities", "List verified SendGrid sender identities."),
  action("sendgrid_read_stats", "Read statistics", "Read bounded delivery statistics."),
];
const writes = [
  action("sendgrid_send_mail", "Send mail", "Sending mail requires approval in Safe mode."),
  action("sendgrid_full_api", "Use full SendGrid API", "Any other SendGrid v3 operation requires approval in Safe mode."),
];

export const SENDGRID_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sendgrid",
  name: "SendGrid",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.twilio.com/docs/sendgrid/api-reference",
  providerWebsiteUrl: "https://sendgrid.com",
  capabilities: [
    { ...capability("profile", "Account profile", "Read bounded SendGrid account profile metadata.", true), platformCapability: "email_account_profile" },
    { ...capability("sender_identities", "Sender identities", "List verified sender identities.", true), platformCapability: "email_sender_identities" },
    { ...capability("stats", "Delivery statistics", "Read bounded delivery statistics.", true), platformCapability: "email_delivery_metrics" },
    { ...capability("send", "Send mail", "Send transactional or template email through an approved sender boundary.", true), platformCapability: "email_send" },
    { ...capability("full_api", "Full SendGrid v3 API", "Use the provider-supported SendGrid v3 API within the API key's permissions and configured region.", false), platformCapability: "sendgrid_full_api" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "SENDGRID_API_KEY", label: "SendGrid API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create your own Custom Access key with only the permissions the agent needs." },
      { name: "SENDGRID_REGION", label: "SendGrid region", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Use GLOBAL or EU for the account or regional subuser." },
      { name: "SENDGRID_SENDER_BOUNDARY", label: "Sender boundary", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Enter an exact verified sender email or authenticated domain." },
    ],
  },
  tools: [
    { name: "sendgrid.getProfile", functionName: "sendgrid_get_profile", aliases: ["sendgrid.getProfile", "sendgrid_get_profile"], capability: "profile", platformCapability: "email_account_profile", action: "read", approvalRequired: false, description: "Read bounded SendGrid account profile metadata.", inputSchema: emptySchema() },
    { name: "sendgrid.listVerifiedSenders", functionName: "sendgrid_list_verified_senders", aliases: ["sendgrid.listVerifiedSenders", "sendgrid_list_verified_senders"], capability: "sender_identities", platformCapability: "email_sender_identities", action: "read", approvalRequired: false, description: "List a bounded page of verified sender identities.", inputSchema: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 100, default: 25 } }, additionalProperties: false } },
    { name: "sendgrid.getStats", functionName: "sendgrid_get_stats", aliases: ["sendgrid.getStats", "sendgrid_get_stats"], capability: "stats", platformCapability: "email_delivery_metrics", action: "read", approvalRequired: false, description: "Read bounded aggregate delivery statistics.", inputSchema: { type: "object", properties: { startDate: { type: "string" }, endDate: { type: "string" }, aggregatedBy: { type: "string", enum: ["day", "week", "month"] } }, required: ["startDate"], additionalProperties: false } },
    { name: "sendgrid.sendMail", functionName: "sendgrid_send_mail", aliases: ["sendgrid.sendMail", "sendgrid_send_mail", "email_send"], capability: "send", platformCapability: "email_send", action: "write", approvalRequired: true, description: "Send an approved SendGrid v3 Mail Send payload within the configured sender boundary.", inputSchema: { type: "object", properties: { message: { type: "object" }, approvalId: { type: "string" } }, required: ["message"], additionalProperties: false } },
    { name: "sendgrid.request", functionName: "sendgrid_request", aliases: ["sendgrid.request", "sendgrid_request", "sendgrid_full_api"], capability: "full_api", platformCapability: "sendgrid_full_api", action: "admin", approvalRequired: true, description: "Call a SendGrid v3 endpoint at the fixed configured origin. Absolute URLs and credential-bearing fields are rejected.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/v3/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [{ id: "sendgrid_safe", label: "Safe", description: "Bounded reads run directly; sends and every other v3 API operation require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] }],
  healthChecks: [{ id: "key_or_profile", label: "SendGrid key/profile check" }],
};

function emptySchema() { return { type: "object", properties: {}, additionalProperties: false }; }
