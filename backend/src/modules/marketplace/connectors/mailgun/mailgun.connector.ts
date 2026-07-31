import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const safeReads = [
  action("mailgun_read_domain", "Read domain", "Inspect the bound Mailgun domain and its verification state."),
  action("mailgun_read_events", "Read events", "Read bounded delivery events for the bound domain."),
  action("mailgun_read_metrics", "Read metrics", "Read bounded Mailgun delivery metrics."),
];

const approvedWrites = [
  action("mailgun_send_message", "Send message", "Sending email requires approval in Safe mode."),
  action("mailgun_full_api", "Use full Mailgun API", "Any other Mailgun API operation requires approval in Safe mode."),
];

export const MAILGUN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mailgun",
  name: "Mailgun",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://documentation.mailgun.com/docs/mailgun/api-reference",
  providerWebsiteUrl: "https://www.mailgun.com",
  capabilities: [
    { ...capability("domain_status", "Domain status", "Inspect the configured domain, DNS verification, and sending state.", true), platformCapability: "email_domain_status" },
    { ...capability("events_logs", "Events and logs", "Read bounded delivery events and logs for the configured domain.", true), platformCapability: "email_delivery_events" },
    { ...capability("metrics", "Metrics", "Query bounded Mailgun delivery metrics.", true), platformCapability: "email_delivery_metrics" },
    { ...capability("send", "Send messages", "Send messages through the configured and provider-authorized domain.", true), platformCapability: "email_send" },
    { ...capability("full_api", "Full Mailgun API", "Use the provider-supported Mailgun HTTP API within the configured account, domain, and region.", false), platformCapability: "mailgun_full_api" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "MAILGUN_API_KEY", label: "Mailgun API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Use your own Mailgun account/RBAC key, or a Domain Sending Key for send-only access." },
      { name: "MAILGUN_DOMAIN", label: "Mailgun domain", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "The Mailgun domain this connection is allowed to use." },
      { name: "MAILGUN_REGION", label: "Mailgun region", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Use US or EU to match the region that owns the domain." },
      { name: "MAILGUN_KEY_TYPE", label: "Key type", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Use account for account/RBAC keys or domain_sending for a Domain Sending Key." },
    ],
  },
  tools: [
    {
      name: "mailgun.getDomain",
      functionName: "mailgun_get_domain",
      aliases: ["mailgun.getDomain", "mailgun_get_domain"],
      capability: "domain_status",
      platformCapability: "email_domain_status",
      action: "read",
      approvalRequired: false,
      description: "Read the configured Mailgun domain and verification state.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "mailgun.listEvents",
      functionName: "mailgun_list_events",
      aliases: ["mailgun.listEvents", "mailgun_list_events"],
      capability: "events_logs",
      platformCapability: "email_delivery_events",
      action: "read",
      approvalRequired: false,
      description: "List a bounded page of delivery events for the configured domain.",
      inputSchema: { type: "object", properties: { event: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 100, default: 25 }, begin: { type: "string" }, end: { type: "string" }, ascending: { type: "boolean", default: false } }, additionalProperties: false },
    },
    {
      name: "mailgun.queryMetrics",
      functionName: "mailgun_query_metrics",
      aliases: ["mailgun.queryMetrics", "mailgun_query_metrics"],
      capability: "metrics",
      platformCapability: "email_delivery_metrics",
      action: "read",
      approvalRequired: false,
      description: "Query bounded delivery metrics for the configured domain.",
      inputSchema: { type: "object", properties: { start: { type: "string" }, end: { type: "string" }, duration: { type: "string" }, resolution: { type: "string" }, metrics: { type: "array", items: { type: "string" }, maxItems: 25 } }, additionalProperties: false },
    },
    {
      name: "mailgun.sendMessage",
      functionName: "mailgun_send_message",
      aliases: ["mailgun.sendMessage", "mailgun_send_message", "email_send"],
      capability: "send",
      platformCapability: "email_send",
      action: "write",
      approvalRequired: true,
      description: "Send an approved email through the configured Mailgun domain.",
      inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 }, cc: { type: "array", items: { type: "string" }, maxItems: 100 }, bcc: { type: "array", items: { type: "string" }, maxItems: 100 }, subject: { type: "string", maxLength: 998 }, text: { type: "string" }, html: { type: "string" }, replyTo: { type: "string" }, tags: { type: "array", items: { type: "string" }, maxItems: 3 }, approvalId: { type: "string" } }, required: ["from", "to", "subject"], additionalProperties: false },
    },
    {
      name: "mailgun.request",
      functionName: "mailgun_request",
      aliases: ["mailgun.request", "mailgun_request", "mailgun_full_api"],
      capability: "full_api",
      platformCapability: "mailgun_full_api",
      action: "admin",
      approvalRequired: true,
      description: "Call a Mailgun API endpoint at the fixed regional origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/v[1-5]/" }, query: { type: "object" }, fields: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false },
    },
  ],
  approvalProfiles: [
    { id: "mailgun_safe", label: "Safe", description: "Bounded domain, event, and metric reads run directly; sends and all other API operations require approval.", defaultSelected: true, allowedActions: safeReads, approvalRequiredActions: approvedWrites, blockedActions: [] },
  ],
  healthChecks: [{ id: "domain_or_key", label: "Mailgun domain/key check" }],
};
