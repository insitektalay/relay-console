import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "mailchimp_transactional_account_get",
    "Read account",
    "Read bounded Transactional account, reputation, quota, and aggregate sending metadata with secrets redacted.",
  ),
  action(
    "mailchimp_transactional_sender_domains_list",
    "List sender domains",
    "List bounded sender-domain authentication state with verification secrets redacted.",
  ),
  action(
    "mailchimp_transactional_senders_list",
    "List senders",
    "List bounded sender identities and aggregate delivery statistics.",
  ),
];

const writes = [
  action(
    "mailchimp_transactional_send",
    "Send transactional email",
    "Sending direct or template email requires approval in Safe mode.",
  ),
  action(
    "mailchimp_transactional_full_api",
    "Use Transactional API",
    "Every other supported Transactional API operation requires approval in Safe mode.",
  ),
];

const blocked = [
  action(
    "mailchimp_transactional_sms",
    "Send SMS",
    "Transactional SMS sending is outside this email connector boundary.",
  ),
  action(
    "mailchimp_transactional_raw_or_export",
    "Relay raw MIME or export data",
    "Raw MIME relay and export jobs are blocked to prevent unbounded or credential-bearing transfer.",
  ),
  action(
    "mailchimp_transactional_secret_input",
    "Supply credentials in tool input",
    "API keys and other credential-bearing fields are always rejected.",
  ),
];

export const MAILCHIMP_TRANSACTIONAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "mailchimp-transactional",
    name: "Mailchimp Transactional",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://mailchimp.com/developer/transactional/api/",
    providerWebsiteUrl: "https://mailchimp.com/features/transactional-email/",
    capabilities: [
      {
        ...capability(
          "account",
          "Account",
          "Read bounded account, quota, reputation, and aggregate sending metadata.",
          true,
        ),
        platformCapability: "email_account_profile",
      },
      {
        ...capability(
          "sender_domains",
          "Sender domains",
          "Read bounded sender-domain authentication state.",
          true,
        ),
        platformCapability: "email_sender_domains",
      },
      {
        ...capability(
          "sender_stats",
          "Sender statistics",
          "Read bounded sender identities and aggregate delivery statistics.",
          true,
        ),
        platformCapability: "email_delivery_metrics",
      },
      {
        ...capability(
          "send",
          "Send email",
          "Send direct, Transactional-template, or Mailchimp-template email from the configured sender boundary.",
          true,
        ),
        platformCapability: "email_send",
      },
      {
        ...capability(
          "full_api",
          "Full Transactional API",
          "Use other documented JSON API methods within the customer key's provider permissions and Relay's fixed safety boundaries.",
          false,
        ),
        platformCapability: "mailchimp_transactional_full_api",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "MAILCHIMP_TRANSACTIONAL_API_KEY",
          label: "Mailchimp Transactional API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Create a customer-owned key and restrict its endpoint and IP permissions as narrowly as practical.",
        },
        {
          name: "MAILCHIMP_TRANSACTIONAL_SENDER_BOUNDARY",
          label: "Sender boundary",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Enter one exact verified sender email or authenticated sending domain.",
        },
      ],
    },
    tools: [
      {
        name: "mailchimpTransactional.getAccount",
        functionName: "mailchimp_transactional_get_account",
        aliases: [
          "mailchimpTransactional.getAccount",
          "mailchimp_transactional_get_account",
        ],
        capability: "account",
        platformCapability: "email_account_profile",
        action: "read",
        approvalRequired: false,
        description: "Read bounded account and aggregate sending metadata.",
        inputSchema: emptySchema(),
      },
      {
        name: "mailchimpTransactional.listSenderDomains",
        functionName: "mailchimp_transactional_list_sender_domains",
        aliases: [
          "mailchimpTransactional.listSenderDomains",
          "mailchimp_transactional_list_sender_domains",
        ],
        capability: "sender_domains",
        platformCapability: "email_sender_domains",
        action: "read",
        approvalRequired: false,
        description: "List bounded sending-domain authentication state.",
        inputSchema: emptySchema(),
      },
      {
        name: "mailchimpTransactional.listSenders",
        functionName: "mailchimp_transactional_list_senders",
        aliases: [
          "mailchimpTransactional.listSenders",
          "mailchimp_transactional_list_senders",
        ],
        capability: "sender_stats",
        platformCapability: "email_delivery_metrics",
        action: "read",
        approvalRequired: false,
        description: "List bounded sender identities and aggregate statistics.",
        inputSchema: emptySchema(),
      },
      sendTool(
        "mailchimpTransactional.sendMessage",
        "mailchimp_transactional_send_message",
        "Send an approved direct transactional email.",
        { message: { type: "object" }, ...deliveryProperties() },
        ["message"],
        ["email_send"],
      ),
      sendTool(
        "mailchimpTransactional.sendTemplate",
        "mailchimp_transactional_send_template",
        "Send an approved Transactional-template email.",
        {
          templateName: { type: "string" },
          templateContent: { type: "array", items: { type: "object" } },
          message: { type: "object" },
          ...deliveryProperties(),
        },
        ["templateName", "message"],
      ),
      sendTool(
        "mailchimpTransactional.sendMailchimpTemplate",
        "mailchimp_transactional_send_mailchimp_template",
        "Send an approved Mailchimp-template email.",
        {
          templateId: { type: "integer", minimum: 1 },
          templateVersion: { type: "string", enum: ["draft", "published"] },
          message: { type: "object" },
          ...deliveryProperties(),
        },
        ["templateId", "message"],
      ),
      {
        name: "mailchimpTransactional.request",
        functionName: "mailchimp_transactional_request",
        aliases: [
          "mailchimpTransactional.request",
          "mailchimp_transactional_request",
          "mailchimp_transactional_full_api",
        ],
        capability: "full_api",
        platformCapability: "mailchimp_transactional_full_api",
        action: "admin",
        approvalRequired: true,
        description:
          "Call one documented Transactional JSON method at the fixed provider origin; sends, SMS, raw MIME, exports, absolute URLs, and credential fields are rejected.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              pattern: "^/[a-z0-9-]+/[a-z0-9-]+(?:\\.json)?$",
            },
            payload: { type: "object" },
            approvalId: { type: "string" },
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "mailchimp_transactional_safe",
        label: "Safe",
        description:
          "Bounded account and sender reads run directly; sends and all other supported API methods require approval.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: writes,
        blockedActions: blocked,
      },
    ],
    healthChecks: [
      {
        id: "api_key_ping",
        label: "Mailchimp Transactional API-key ping",
      },
    ],
  };

function sendTool(
  name: string,
  functionName: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  extraAliases: string[] = [],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName, ...extraAliases],
    capability: "send",
    platformCapability: "email_send",
    action: "write" as const,
    approvalRequired: true,
    description,
    inputSchema: {
      type: "object",
      properties: { ...properties, approvalId: { type: "string" } },
      required,
      additionalProperties: false,
    },
  };
}

function deliveryProperties() {
  return {
    async: { type: "boolean" },
    ipPool: { type: "string" },
    sendAt: { type: "string" },
  };
}

function emptySchema() {
  return { type: "object", properties: {}, additionalProperties: false };
}
