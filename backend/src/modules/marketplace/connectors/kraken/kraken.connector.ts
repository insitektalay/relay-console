import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const marketRead = action(
  "kraken_market_read",
  "Read Kraken spot markets",
  "Read one bounded public ticker, order-book, or OHLC summary.",
);
const accountRead = action(
  "kraken_account_read",
  "Read Kraken account data",
  "Read one bounded balance, order, trade, or ledger page; Safe mode requires approval.",
);
const orderPlace = action(
  "kraken_order_place",
  "Place a Kraken spot order",
  "Place one typed market or limit spot order; Safe mode requires approval.",
);
const orderCancel = action(
  "kraken_order_cancel",
  "Cancel a Kraken spot order",
  "Cancel one exact spot order; Safe mode requires approval.",
);
const fundingBlocked = blocked(
  "kraken_funding_blocked",
  "Funding and transfers unavailable",
  "Deposits, withdrawals, wallet transfers, subaccount transfers, and address management are outside Relay's V1 surface.",
);
const broaderTradingBlocked = blocked(
  "kraken_broader_trading_blocked",
  "Broader trading unavailable",
  "Batch orders, amend/edit, margin controls, derivatives, OTC, WebSocket/FIX tokens, and raw endpoint delegation are outside V1.",
);
const earnExportBlocked = blocked(
  "kraken_earn_export_blocked",
  "Earn and exports unavailable",
  "Earn allocation, deallocation, data exports, and API-key administration are outside V1.",
);

export const KRAKEN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "kraken",
  name: "Kraken",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.kraken.com/api/",
  providerWebsiteUrl: "https://www.kraken.com/",
  capabilities: [
    {
      ...capability(
        "market_data",
        "Read spot market data",
        "Read bounded public ticker, order-book, and OHLC summaries for one exact spot pair.",
        true,
      ),
      platformCapability: "kraken_market_data",
    },
    {
      ...capability(
        "account_read",
        "Read account and trading data",
        "Read bounded balances, open or closed orders, trade history, and ledger pages authorized by the customer key.",
        true,
      ),
      platformCapability: "kraken_account_read",
    },
    {
      ...capability(
        "spot_trading",
        "Place and cancel spot orders",
        "Place one typed market or limit spot order and cancel one exact order, subject to Kraken key permissions and trading limits.",
        false,
      ),
      platformCapability: "kraken_spot_trading",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "KRAKEN_API_KEY",
        label: "Kraken API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated Kraken Spot API key with only the permissions needed for selected capabilities.",
      },
      {
        name: "KRAKEN_API_SECRET",
        label: "Kraken private key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste the base64 private key shown once by Kraken. Relay stores it encrypted and uses it only for HMAC signing.",
      },
    ],
  },
  tools: [
    {
      name: "kraken.market.read",
      functionName: "kraken_market_read",
      aliases: ["kraken.market.read", "kraken_market_read"],
      capability: "market_data",
      platformCapability: "kraken_market_data",
      action: "read",
      approvalRequired: false,
      description:
        "Read one bounded Kraken spot ticker, order book, or OHLC summary from the fixed public API origin.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["ticker", "order_book", "ohlc"] },
          pair: { type: "string", pattern: "^[A-Za-z0-9./:-]{3,32}$" },
          interval: {
            type: "integer",
            enum: [1, 5, 15, 30, 60, 240, 1440, 10080, 21600],
          },
        },
        required: ["kind", "pair"],
        additionalProperties: false,
      },
    },
    {
      name: "kraken.account.read",
      functionName: "kraken_account_read",
      aliases: ["kraken.account.read", "kraken_account_read"],
      capability: "account_read",
      platformCapability: "kraken_account_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one bounded private Kraken balance, order, trade, or ledger page with server-side signing.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "balances",
              "open_orders",
              "closed_orders",
              "trades",
              "ledgers",
            ],
          },
          offset: { type: "integer", minimum: 0, maximum: 10000 },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    {
      name: "kraken.order.place",
      functionName: "kraken_order_place",
      aliases: ["kraken.order.place", "kraken_order_place"],
      capability: "spot_trading",
      platformCapability: "kraken_spot_trading",
      action: "write",
      approvalRequired: true,
      description:
        "Place one exact Kraken spot market or limit order; funding and withdrawal operations are unavailable.",
      inputSchema: {
        type: "object",
        properties: {
          pair: { type: "string", pattern: "^[A-Za-z0-9./:-]{3,32}$" },
          side: { type: "string", enum: ["buy", "sell"] },
          orderType: { type: "string", enum: ["market", "limit"] },
          volume: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,18})?$" },
          price: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,18})?$" },
          validateOnly: { type: "boolean" },
        },
        required: ["pair", "side", "orderType", "volume"],
        additionalProperties: false,
      },
    },
    {
      name: "kraken.order.cancel",
      functionName: "kraken_order_cancel",
      aliases: ["kraken.order.cancel", "kraken_order_cancel"],
      capability: "spot_trading",
      platformCapability: "kraken_spot_trading",
      action: "write",
      approvalRequired: true,
      description: "Cancel one exact Kraken spot order by transaction ID.",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: {
            type: "string",
            pattern: "^[A-Za-z0-9-]{6,64}$",
          },
        },
        required: ["transactionId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "kraken_safe",
      label: "Safe",
      description:
        "Public market summaries run directly; every private account read and every financial order action requires approval.",
      defaultSelected: true,
      allowedActions: [marketRead],
      approvalRequiredActions: [accountRead, orderPlace, orderCancel],
      blockedActions: [
        fundingBlocked,
        broaderTradingBlocked,
        earnExportBlocked,
      ],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected Kraken market, account, and spot-order actions run without Relay per-action approval; connection ownership, key permissions, fixed routing, nonce discipline, bounds, redaction, audits, and Kraken limits still apply.",
      defaultSelected: false,
      allowedActions: [marketRead, accountRead, orderPlace, orderCancel],
      approvalRequiredActions: [],
      blockedActions: [
        fundingBlocked,
        broaderTradingBlocked,
        earnExportBlocked,
      ],
    },
  ],
  healthChecks: [{ id: "credentials", label: "Kraken API-key validation" }],
};
