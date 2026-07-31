import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "paypal_transaction_list",
    "List transactions",
    "Read up to twenty-five privacy-redacted transaction summaries within an explicit period of no more than thirty-one days.",
  ),
  action(
    "paypal_transaction_get",
    "Find transaction",
    "Find privacy-redacted records for one exact PayPal transaction ID within an explicit date range.",
  ),
  action(
    "paypal_order_get",
    "Read order status",
    "Read one exact checkout order with payer contact and shipping data removed.",
  ),
  action(
    "paypal_capture_get",
    "Read capture status",
    "Read one exact captured payment with private payer and seller-receivable details removed.",
  ),
];
const blockedActions = [
  blocked(
    "paypal_financial_mutation",
    "Move or change money",
    "Creating, approving, authorizing, capturing, voiding, refunding, or paying out funds is outside V1.",
  ),
  blocked(
    "paypal_private_data",
    "Read private customer data",
    "Payer identity, contact, address, shipping, notes, cart contents, and raw transaction records are outside V1.",
  ),
  blocked(
    "paypal_broader_admin",
    "Administer PayPal",
    "Disputes, invoices, subscriptions, vaults, webhooks, seller onboarding, partner features, and account settings are outside V1.",
  ),
  blocked(
    "paypal_raw_api",
    "Use arbitrary PayPal APIs",
    "Arbitrary paths, headers, fields, pagination, partner assertions, and raw API access are outside V1.",
  ),
];
const id = (maximum: number) => ({
  type: "string",
  minLength: 1,
  maxLength: maximum,
  pattern: "^[A-Za-z0-9_-]+$",
});
const dateTime = () => ({
  type: "string",
  minLength: 20,
  maxLength: 40,
  format: "date-time",
});
const tool = (
  name: string,
  functionName: string,
  capabilityId: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: capabilityId,
  platformCapability: `paypal_${capabilityId}`,
  action: "read" as const,
  approvalRequired: true,
  description,
  inputSchema: {
    type: "object",
    properties: {
      ...properties,
      approvalId: { type: "string", minLength: 1, maxLength: 200 },
    },
    required: [...required, "approvalId"],
    additionalProperties: false,
  },
});

export const PAYPAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "paypal",
  name: "PayPal",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.paypal.com/api/rest/authentication/",
  providerWebsiteUrl: "https://www.paypal.com/",
  capabilities: [
    {
      ...capability(
        "transaction_read",
        "Read transaction activity",
        "List bounded redacted transaction history or find one exact transaction.",
        true,
      ),
      platformCapability: "paypal_transaction_read",
    },
    {
      ...capability(
        "payment_status_read",
        "Read payment status",
        "Inspect one exact checkout order or captured payment without changing financial state.",
        true,
      ),
      platformCapability: "paypal_payment_status_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PAYPAL_CLIENT_ID",
        label: "PayPal client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use a dedicated REST app owned by the connected business.",
      },
      {
        name: "PAYPAL_CLIENT_SECRET",
        label: "PayPal client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Relay encrypts the secret and never exposes it to agents.",
      },
      {
        name: "PAYPAL_ENVIRONMENT",
        label: "PayPal environment",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter sandbox or live.",
      },
    ],
  },
  tools: [
    tool(
      "paypal.listTransactions",
      "paypal_transaction_list",
      "transaction_read",
      "Read up to twenty-five privacy-redacted transactions in a period of no more than thirty-one days.",
      {
        startDate: dateTime(),
        endDate: dateTime(),
        page: { type: "integer", minimum: 1, maximum: 10_000 },
        maxResults: { type: "integer", minimum: 1, maximum: 25 },
        status: { type: "string", enum: ["D", "P", "S", "V"] },
        currency: { type: "string", pattern: "^[A-Z]{3}$" },
      },
      ["startDate", "endDate"],
    ),
    tool(
      "paypal.getTransaction",
      "paypal_transaction_get",
      "transaction_read",
      "Find redacted records for one exact PayPal transaction ID within an explicit date range.",
      {
        transactionId: id(24),
        startDate: dateTime(),
        endDate: dateTime(),
      },
      ["transactionId", "startDate", "endDate"],
    ),
    tool(
      "paypal.getOrder",
      "paypal_order_get",
      "payment_status_read",
      "Read one exact checkout order with payer and shipping data removed.",
      { orderId: id(36) },
      ["orderId"],
    ),
    tool(
      "paypal.getCapture",
      "paypal_capture_get",
      "payment_status_read",
      "Read one exact captured payment with private fields removed.",
      { captureId: id(64) },
      ["captureId"],
    ),
  ],
  approvalProfiles: [
    {
      id: "paypal_safe",
      label: "Safe",
      description:
        "Every PayPal financial-status read requires matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected read-only PayPal V1 tools run without Relay per-action approval; bounds, redaction, audits, and provider authority still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "paypal_client_credentials",
      label: "PayPal REST app credentials can obtain a scoped access token",
    },
  ],
};
