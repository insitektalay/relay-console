import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const marketRead = action(
  "binance_market_read",
  "Read Binance spot markets",
  "Read one bounded public ticker, order-book, or candlestick summary.",
);
const accountRead = action(
  "binance_account_read",
  "Read Binance account data",
  "Read one bounded balance, open-order, order-history, or trade-history result; Safe mode requires approval.",
);
const orderPlace = action(
  "binance_order_place",
  "Place a Binance spot order",
  "Place one typed market or limit spot order; Safe mode requires approval.",
);
const orderCancel = action(
  "binance_order_cancel",
  "Cancel a Binance spot order",
  "Cancel one exact spot order; Safe mode requires approval.",
);
const fundingBlocked = blocked(
  "binance_funding_blocked",
  "Funding and transfers unavailable",
  "Deposits, withdrawals, wallet transfers, Convert, Pay, P2P, gift cards, and address management are outside Relay's V1 surface.",
);
const broaderTradingBlocked = blocked(
  "binance_broader_trading_blocked",
  "Broader trading unavailable",
  "Batch and replace orders, margin, futures, options, portfolio margin, OTC, algo trading, subaccounts, WebSocket/FIX sessions, and raw endpoint delegation are outside V1.",
);
const earnAdminBlocked = blocked(
  "binance_earn_admin_blocked",
  "Earn and administration unavailable",
  "Simple Earn, staking, mining, loans, copy trading, reports, tax exports, and API-key administration are outside V1.",
);

export const BINANCE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "binance",
  name: "Binance",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.binance.com/en/docs/products/spot/rest-api",
  providerWebsiteUrl: "https://www.binance.com/",
  capabilities: [
    {
      ...capability(
        "market_data",
        "Read spot market data",
        "Read bounded public 24-hour ticker, order-book, and candlestick summaries for one exact spot symbol.",
        true,
      ),
      platformCapability: "binance_market_data",
    },
    {
      ...capability(
        "account_read",
        "Read account and trading data",
        "Read bounded balances, open orders, order history, and trade history authorized by the customer key.",
        true,
      ),
      platformCapability: "binance_account_read",
    },
    {
      ...capability(
        "spot_trading",
        "Place and cancel spot orders",
        "Place one typed market or limit spot order and cancel one exact order, subject to Binance key permissions and trading filters.",
        false,
      ),
      platformCapability: "binance_spot_trading",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BINANCE_API_KEY",
        label: "Binance API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated Binance Spot HMAC API key with only USER_DATA and, when selected, Spot trading permission.",
      },
      {
        name: "BINANCE_API_SECRET",
        label: "Binance secret key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste the HMAC secret shown by Binance. Relay stores it encrypted and uses it only to sign fixed-origin Spot REST requests.",
      },
    ],
  },
  tools: [
    {
      name: "binance.market.read",
      functionName: "binance_market_read",
      aliases: ["binance.market.read", "binance_market_read"],
      capability: "market_data",
      platformCapability: "binance_market_data",
      action: "read",
      approvalRequired: false,
      description:
        "Read one bounded Binance spot ticker, order book, or candlestick summary from the fixed public API origin.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["ticker", "order_book", "klines"] },
          symbol: { type: "string", pattern: "^[A-Za-z0-9]{5,20}$" },
          interval: {
            type: "string",
            enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"],
          },
        },
        required: ["kind", "symbol"],
        additionalProperties: false,
      },
    },
    {
      name: "binance.account.read",
      functionName: "binance_account_read",
      aliases: ["binance.account.read", "binance_account_read"],
      capability: "account_read",
      platformCapability: "binance_account_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one bounded private Binance balance, open-order, order-history, or trade-history result with server-side signing.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["balances", "open_orders", "order_history", "trades"],
          },
          symbol: { type: "string", pattern: "^[A-Za-z0-9]{5,20}$" },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    {
      name: "binance.order.place",
      functionName: "binance_order_place",
      aliases: ["binance.order.place", "binance_order_place"],
      capability: "spot_trading",
      platformCapability: "binance_spot_trading",
      action: "write",
      approvalRequired: true,
      description:
        "Place one exact Binance spot market or GTC limit order; funding and withdrawal operations are unavailable.",
      inputSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", pattern: "^[A-Za-z0-9]{5,20}$" },
          side: { type: "string", enum: ["buy", "sell"] },
          orderType: { type: "string", enum: ["market", "limit"] },
          quantity: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,18})?$" },
          price: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,18})?$" },
        },
        required: ["symbol", "side", "orderType", "quantity"],
        additionalProperties: false,
      },
    },
    {
      name: "binance.order.cancel",
      functionName: "binance_order_cancel",
      aliases: ["binance.order.cancel", "binance_order_cancel"],
      capability: "spot_trading",
      platformCapability: "binance_spot_trading",
      action: "write",
      approvalRequired: true,
      description:
        "Cancel one exact Binance spot order by symbol and numeric order ID.",
      inputSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", pattern: "^[A-Za-z0-9]{5,20}$" },
          orderId: { type: "string", pattern: "^[0-9]{1,30}$" },
        },
        required: ["symbol", "orderId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "binance_safe",
      label: "Safe",
      description:
        "Public market summaries run directly; every private account read and every financial order action requires approval.",
      defaultSelected: true,
      allowedActions: [marketRead],
      approvalRequiredActions: [accountRead, orderPlace, orderCancel],
      blockedActions: [fundingBlocked, broaderTradingBlocked, earnAdminBlocked],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected Binance market, account, and spot-order actions run without Relay per-action approval; connection ownership, key permissions, fixed routing, signing, bounds, redaction, audits, and Binance limits still apply.",
      defaultSelected: false,
      allowedActions: [marketRead, accountRead, orderPlace, orderCancel],
      approvalRequiredActions: [],
      blockedActions: [fundingBlocked, broaderTradingBlocked, earnAdminBlocked],
    },
  ],
  healthChecks: [{ id: "credentials", label: "Binance API-key validation" }],
};
