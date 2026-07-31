import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const marketRead = action(
  "gemini_market_read",
  "Read Gemini spot markets",
  "Read one bounded public ticker, order-book, or candle summary.",
);
const accountRead = action(
  "gemini_account_read",
  "Read Gemini account data",
  "Read one bounded balance, active-order, trade-history, or exact order-status result; Safe mode requires approval.",
);
const orderPlace = action(
  "gemini_order_place",
  "Place a Gemini spot limit order",
  "Place one typed limit spot order with an exact execution option; Safe mode requires approval.",
);
const orderCancel = action(
  "gemini_order_cancel",
  "Cancel a Gemini spot order",
  "Cancel one exact spot order; Safe mode requires approval.",
);
const fundingBlocked = blocked(
  "gemini_funding_blocked",
  "Funding and transfers unavailable",
  "Deposit addresses, withdrawals, internal transfers, custody movements, and Fund Manager operations are outside Relay's V1 surface.",
);
const broaderTradingBlocked = blocked(
  "gemini_broader_trading_blocked",
  "Broader trading unavailable",
  "Batch cancellation, wrap orders, clearing, auctions, perpetuals, derivatives, FIX/WebSocket sessions, heartbeat cancellation, and raw endpoint delegation are outside V1.",
);
const adminBlocked = blocked(
  "gemini_admin_blocked",
  "Administration unavailable",
  "Master-key account selection, account administration, API-key management, reports, and institutional administration are outside V1.",
);

export const GEMINI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "gemini",
  name: "Gemini",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.gemini.com/rest-api/",
  providerWebsiteUrl: "https://www.gemini.com/",
  capabilities: [
    {
      ...capability(
        "market_data",
        "Read spot market data",
        "Read bounded public ticker, order-book, and candle summaries for one exact Gemini spot symbol.",
        true,
      ),
      platformCapability: "gemini_market_data",
    },
    {
      ...capability(
        "account_read",
        "Read account and trading data",
        "Read bounded balances, active orders, past trades, and exact order status authorized by an Auditor or Trader key.",
        true,
      ),
      platformCapability: "gemini_account_read",
    },
    {
      ...capability(
        "spot_trading",
        "Place and cancel spot limit orders",
        "Place one typed limit spot order and cancel one exact order, subject to the Trader role and Gemini trading limits.",
        false,
      ),
      platformCapability: "gemini_spot_trading",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GEMINI_API_KEY",
        label: "Gemini API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated account-scoped Gemini key with Auditor for reads or Trader only when spot trading is selected. Do not use Fund Manager or Master administration authority.",
      },
      {
        name: "GEMINI_API_SECRET",
        label: "Gemini API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste the Gemini API secret. Relay stores it encrypted and uses it only to HMAC-SHA384 sign base64 request payloads for the fixed Exchange REST origin.",
      },
    ],
  },
  tools: [
    {
      name: "gemini.market.read",
      functionName: "gemini_market_read",
      aliases: ["gemini.market.read", "gemini_market_read"],
      capability: "market_data",
      platformCapability: "gemini_market_data",
      action: "read",
      approvalRequired: false,
      description:
        "Read one bounded Gemini spot ticker, order book, or candle summary from the fixed public API origin.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["ticker", "order_book", "candles"] },
          symbol: { type: "string", pattern: "^[A-Za-z0-9]{5,20}$" },
          interval: {
            type: "string",
            enum: ["1m", "5m", "15m", "30m", "1h", "6h", "1d"],
          },
        },
        required: ["kind", "symbol"],
        additionalProperties: false,
      },
    },
    {
      name: "gemini.account.read",
      functionName: "gemini_account_read",
      aliases: ["gemini.account.read", "gemini_account_read"],
      capability: "account_read",
      platformCapability: "gemini_account_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one bounded private Gemini balance, active-order, past-trade, or exact order-status result with server-side signing.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["balances", "active_orders", "trades", "order_status"],
          },
          symbol: { type: "string", pattern: "^[A-Za-z0-9]{5,20}$" },
          orderId: { type: "string", pattern: "^[0-9]{1,16}$" },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    {
      name: "gemini.order.place",
      functionName: "gemini_order_place",
      aliases: ["gemini.order.place", "gemini_order_place"],
      capability: "spot_trading",
      platformCapability: "gemini_spot_trading",
      action: "write",
      approvalRequired: true,
      description:
        "Place one exact Gemini spot limit order; market, funding, and derivative operations are unavailable.",
      inputSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", pattern: "^[A-Za-z0-9]{5,20}$" },
          side: { type: "string", enum: ["buy", "sell"] },
          amount: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,18})?$" },
          price: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,18})?$" },
          execution: {
            type: "string",
            enum: [
              "limit",
              "maker_or_cancel",
              "immediate_or_cancel",
              "fill_or_kill",
            ],
          },
          clientOrderId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" },
        },
        required: ["symbol", "side", "amount", "price", "execution"],
        additionalProperties: false,
      },
    },
    {
      name: "gemini.order.cancel",
      functionName: "gemini_order_cancel",
      aliases: ["gemini.order.cancel", "gemini_order_cancel"],
      capability: "spot_trading",
      platformCapability: "gemini_spot_trading",
      action: "write",
      approvalRequired: true,
      description: "Cancel one exact Gemini spot order by numeric order ID.",
      inputSchema: {
        type: "object",
        properties: {
          orderId: { type: "string", pattern: "^[0-9]{1,16}$" },
        },
        required: ["orderId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "gemini_safe",
      label: "Safe",
      description:
        "Public market summaries run directly; every private account read and every financial order action requires approval.",
      defaultSelected: true,
      allowedActions: [marketRead],
      approvalRequiredActions: [accountRead, orderPlace, orderCancel],
      blockedActions: [fundingBlocked, broaderTradingBlocked, adminBlocked],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected Gemini market, account, and spot-order actions run without Relay per-action approval; connection ownership, API roles, fixed routing, nonce discipline, signing, bounds, redaction, audits, and Gemini limits still apply.",
      defaultSelected: false,
      allowedActions: [marketRead, accountRead, orderPlace, orderCancel],
      approvalRequiredActions: [],
      blockedActions: [fundingBlocked, broaderTradingBlocked, adminBlocked],
    },
  ],
  healthChecks: [{ id: "credentials", label: "Gemini API-key validation" }],
};
