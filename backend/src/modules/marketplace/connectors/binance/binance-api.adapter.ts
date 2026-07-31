import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type BinanceCredentials = { apiKey: string; apiSecret: string };

export class BinanceApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export function binanceSignature(payload: string, apiSecret: string) {
  return createHmac("sha256", apiSecret).update(payload).digest("hex");
}

@Injectable()
export class BinanceApiAdapter {
  private readonly origin = "https://api.binance.com";

  async health(credentials: BinanceCredentials) {
    return this.signedRequest(credentials, "GET", "/api/v3/account", {
      omitZeroBalances: "true",
    });
  }

  async market(input: JsonObject) {
    const kind = this.enumValue(
      input.kind,
      ["ticker", "order_book", "klines"],
      "market kind",
    );
    const symbol = this.symbol(input.symbol);
    const routes: Record<string, string> = {
      ticker: "/api/v3/ticker/24hr",
      order_book: "/api/v3/depth",
      klines: "/api/v3/klines",
    };
    const params: Record<string, string> = { symbol };
    if (kind === "order_book") params.limit = "20";
    if (kind === "klines") {
      params.interval = this.interval(input.interval);
      params.limit = "100";
    }
    const data = await this.publicRequest(routes[kind], params);
    return this.boundResult(data, kind === "ticker" ? 100 : 100);
  }

  async account(credentials: BinanceCredentials, input: JsonObject) {
    const kind = this.enumValue(
      input.kind,
      ["balances", "open_orders", "order_history", "trades"],
      "account read kind",
    );
    if (kind === "balances") {
      const data = (await this.signedRequest(
        credentials,
        "GET",
        "/api/v3/account",
        { omitZeroBalances: "true" },
      )) as JsonObject;
      return this.boundResult(data, 200);
    }
    const symbol = this.symbol(input.symbol);
    const routes: Record<string, string> = {
      open_orders: "/api/v3/openOrders",
      order_history: "/api/v3/allOrders",
      trades: "/api/v3/myTrades",
    };
    return this.boundResult(
      await this.signedRequest(credentials, "GET", routes[kind], {
        symbol,
        ...(kind === "open_orders" ? {} : { limit: "100" }),
      }),
      100,
    );
  }

  async placeOrder(credentials: BinanceCredentials, input: JsonObject) {
    const symbol = this.symbol(input.symbol);
    const side = this.enumValue(input.side, ["buy", "sell"], "order side");
    const orderType = this.enumValue(
      input.orderType,
      ["market", "limit"],
      "order type",
    );
    const quantity = this.decimal(input.quantity, "quantity");
    const price =
      input.price === undefined
        ? undefined
        : this.decimal(input.price, "price");
    if (orderType === "limit" && !price)
      throw new BinanceApiError(
        "provider_validation_error",
        "Binance limit orders require a price.",
      );
    if (orderType === "market" && price)
      throw new BinanceApiError(
        "provider_validation_error",
        "Binance market orders cannot include a price.",
      );
    return this.signedRequest(credentials, "POST", "/api/v3/order", {
      symbol,
      side: side.toUpperCase(),
      type: orderType.toUpperCase(),
      quantity,
      ...(orderType === "limit" ? { timeInForce: "GTC", price: price! } : {}),
      newOrderRespType: "RESULT",
    });
  }

  async cancelOrder(credentials: BinanceCredentials, input: JsonObject) {
    const symbol = this.symbol(input.symbol);
    if (
      typeof input.orderId !== "string" ||
      !/^[0-9]{1,30}$/.test(input.orderId)
    )
      throw new BinanceApiError(
        "provider_validation_error",
        "Binance order ID must be a numeric string.",
      );
    return this.signedRequest(credentials, "DELETE", "/api/v3/order", {
      symbol,
      orderId: input.orderId,
    });
  }

  private async publicRequest(path: string, params: Record<string, string>) {
    const url = new URL(`${this.origin}${path}`);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BinanceApiError(
        "provider_unavailable",
        "Binance could not be reached.",
        502,
      );
    }
    return this.handleResponse(response);
  }

  private async signedRequest(
    credentials: BinanceCredentials,
    method: "GET" | "POST" | "DELETE",
    path: string,
    fields: Record<string, string>,
  ) {
    this.assertCredentials(credentials);
    const form = new URLSearchParams({
      ...fields,
      recvWindow: "5000",
      timestamp: String(Date.now()),
    });
    const payload = form.toString();
    form.set("signature", binanceSignature(payload, credentials.apiSecret));
    const url = new URL(`${this.origin}${path}`);
    url.search = form.toString();
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "X-MBX-APIKEY": credentials.apiKey,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new BinanceApiError(
        "provider_unavailable",
        "Binance could not be reached.",
        502,
      );
    }
    return this.redact(await this.handleResponse(response));
  }

  private async handleResponse(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_000_000)
      throw new BinanceApiError(
        "provider_validation_error",
        "Binance response exceeds 2 MB.",
      );
    let payload: unknown;
    try {
      payload = raw.length
        ? (JSON.parse(raw.toString("utf8")) as unknown)
        : null;
    } catch {
      throw new BinanceApiError(
        "provider_unavailable",
        "Binance returned an invalid response.",
        502,
      );
    }
    if (response.ok) return payload;
    const object =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as JsonObject)
        : {};
    const providerCode = typeof object.code === "number" ? object.code : null;
    const detail =
      typeof object.msg === "string"
        ? object.msg.replace(/[\r\n]+/g, " ").slice(0, 400)
        : `HTTP ${response.status}`;
    const code: MarketplaceConnectorSafeErrorCode =
      response.status === 429 ||
      response.status === 418 ||
      providerCode === -1003
        ? "provider_rate_limited"
        : response.status === 401 ||
            providerCode === -2014 ||
            providerCode === -2015
          ? "credential_missing"
          : response.status === 403 || /permission|not authorized/i.test(detail)
            ? "insufficient_scope"
            : response.status >= 400 && response.status < 500
              ? "provider_validation_error"
              : "provider_unavailable";
    throw new BinanceApiError(
      code,
      `Binance rejected the request: ${detail}.`,
      response.status,
    );
  }

  private assertCredentials(credentials: BinanceCredentials) {
    if (!credentials.apiKey || !credentials.apiSecret)
      throw new BinanceApiError(
        "credential_missing",
        "Binance API key and secret key are required.",
        401,
      );
    if (credentials.apiKey.length > 512 || credentials.apiSecret.length > 512)
      throw new BinanceApiError(
        "provider_validation_error",
        "Binance credentials are invalid.",
      );
  }

  private symbol(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9]{5,20}$/.test(value))
      throw new BinanceApiError(
        "provider_validation_error",
        "Binance symbol must be an exact spot symbol such as BTCUSDT.",
      );
    return value.toUpperCase();
  }

  private decimal(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !/^[0-9]+(?:\.[0-9]{1,18})?$/.test(value) ||
      Number(value) <= 0 ||
      value.length > 40
    )
      throw new BinanceApiError(
        "provider_validation_error",
        `Binance ${label} must be a positive decimal string.`,
      );
    return value;
  }

  private interval(value: unknown) {
    if (value === undefined) return "1h";
    const allowed = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];
    if (typeof value !== "string" || !allowed.includes(value))
      throw new BinanceApiError(
        "provider_validation_error",
        "Binance candlestick interval is unsupported.",
      );
    return value;
  }

  private enumValue(value: unknown, values: string[], label: string) {
    if (typeof value !== "string" || !values.includes(value))
      throw new BinanceApiError(
        "provider_validation_error",
        `Binance ${label} is invalid.`,
      );
    return value;
  }

  private boundResult(value: unknown, limit: number): unknown {
    const redacted = this.redact(value);
    if (Array.isArray(redacted))
      return {
        items: redacted.slice(0, limit),
        truncated: redacted.length > limit,
      };
    if (!redacted || typeof redacted !== "object") return redacted;
    const object = redacted as JsonObject;
    const bounded: JsonObject = {};
    for (const [key, item] of Object.entries(object).slice(0, limit)) {
      if (Array.isArray(item)) {
        bounded[key] = item.slice(0, limit);
        if (item.length > limit) bounded[`${key}Truncated`] = true;
      } else bounded[key] = this.redact(item);
    }
    if (Object.keys(object).length > limit) bounded.truncated = true;
    return bounded;
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== "object") return value;
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(api.?key|signature|secret|password|credential|otp|cookie|authorization)/i.test(
          key,
        )
      )
        output[key] = "[REDACTED]";
      else output[key] = this.redact(item);
    }
    return output;
  }
}
