import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash, createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type GeminiCredentials = { apiKey: string; apiSecret: string };

export class GeminiApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export function geminiSignature(encodedPayload: string, apiSecret: string) {
  return createHmac("sha384", apiSecret).update(encodedPayload).digest("hex");
}

@Injectable()
export class GeminiApiAdapter {
  private readonly origin = "https://api.gemini.com";
  private readonly nonces = new Map<string, number>();

  async health(credentials: GeminiCredentials) {
    return this.privateRequest(credentials, "/v1/balances", {});
  }

  async market(input: JsonObject) {
    const kind = this.enumValue(
      input.kind,
      ["ticker", "order_book", "candles"],
      "market kind",
    );
    const symbol = this.symbol(input.symbol);
    if (kind === "ticker")
      return this.boundResult(
        await this.publicRequest(`/v2/ticker/${symbol}`, {}),
        100,
      );
    if (kind === "order_book")
      return this.boundResult(
        await this.publicRequest(`/v1/book/${symbol}`, {
          limit_bids: "20",
          limit_asks: "20",
        }),
        100,
      );
    return this.boundResult(
      await this.publicRequest(
        `/v2/candles/${symbol}/${this.interval(input.interval)}`,
        {},
      ),
      100,
    );
  }

  async account(credentials: GeminiCredentials, input: JsonObject) {
    const kind = this.enumValue(
      input.kind,
      ["balances", "active_orders", "trades", "order_status"],
      "account read kind",
    );
    if (kind === "balances")
      return this.boundResult(
        await this.privateRequest(credentials, "/v1/balances", {}),
        200,
      );
    if (kind === "active_orders")
      return this.boundResult(
        await this.privateRequest(credentials, "/v1/orders", {}),
        100,
      );
    if (kind === "trades")
      return this.boundResult(
        await this.privateRequest(credentials, "/v1/mytrades", {
          symbol: this.symbol(input.symbol),
          limit_trades: 100,
        }),
        100,
      );
    return this.privateRequest(credentials, "/v1/order/status", {
      order_id: this.orderId(input.orderId),
      include_trades: false,
    });
  }

  async placeOrder(credentials: GeminiCredentials, input: JsonObject) {
    const execution = this.enumValue(
      input.execution,
      ["limit", "maker_or_cancel", "immediate_or_cancel", "fill_or_kill"],
      "execution option",
    );
    const options: Record<string, string[]> = {
      limit: [],
      maker_or_cancel: ["maker-or-cancel"],
      immediate_or_cancel: ["immediate-or-cancel"],
      fill_or_kill: ["fill-or-kill"],
    };
    const clientOrderId = this.optionalClientOrderId(input.clientOrderId);
    return this.privateRequest(credentials, "/v1/order/new", {
      symbol: this.symbol(input.symbol),
      amount: this.decimal(input.amount, "amount"),
      price: this.decimal(input.price, "price"),
      side: this.enumValue(input.side, ["buy", "sell"], "order side"),
      type: "exchange limit",
      options: options[execution],
      ...(clientOrderId ? { client_order_id: clientOrderId } : {}),
    });
  }

  async cancelOrder(credentials: GeminiCredentials, input: JsonObject) {
    return this.privateRequest(credentials, "/v1/order/cancel", {
      order_id: this.orderId(input.orderId),
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
      throw new GeminiApiError(
        "provider_unavailable",
        "Gemini could not be reached.",
        502,
      );
    }
    return this.handleResponse(response);
  }

  private async privateRequest(
    credentials: GeminiCredentials,
    path: string,
    fields: JsonObject,
  ) {
    this.assertCredentials(credentials);
    const payload = Buffer.from(
      JSON.stringify({
        request: path,
        nonce: this.nextNonce(credentials.apiKey),
        ...fields,
      }),
    ).toString("base64");
    const signature = geminiSignature(payload, credentials.apiSecret);
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.origin}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "text/plain",
          "Content-Length": "0",
          "Cache-Control": "no-cache",
          "X-GEMINI-APIKEY": credentials.apiKey,
          "X-GEMINI-PAYLOAD": payload,
          "X-GEMINI-SIGNATURE": signature,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new GeminiApiError(
        "provider_unavailable",
        "Gemini could not be reached.",
        502,
      );
    }
    return this.redact(await this.handleResponse(response));
  }

  private async handleResponse(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_000_000)
      throw new GeminiApiError(
        "provider_validation_error",
        "Gemini response exceeds 2 MB.",
      );
    let payload: unknown;
    try {
      payload = raw.length
        ? (JSON.parse(raw.toString("utf8")) as unknown)
        : null;
    } catch {
      throw new GeminiApiError(
        "provider_unavailable",
        "Gemini returned an invalid response.",
        502,
      );
    }
    const object =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as JsonObject)
        : {};
    if (response.ok && object.result !== "error") return payload;
    const reason = typeof object.reason === "string" ? object.reason : "";
    const message =
      typeof object.message === "string"
        ? object.message.replace(/[\r\n]+/g, " ").slice(0, 400)
        : `HTTP ${response.status}`;
    const code: MarketplaceConnectorSafeErrorCode =
      response.status === 429 || /rate|throttl/i.test(`${reason} ${message}`)
        ? "provider_rate_limited"
        : reason === "MissingRole" || response.status === 403
          ? "insufficient_scope"
          : /InvalidSignature|InvalidApiKey/i.test(reason) ||
              response.status === 401
            ? "credential_missing"
            : response.status >= 400 && response.status < 500
              ? "provider_validation_error"
              : "provider_unavailable";
    throw new GeminiApiError(
      code,
      `Gemini rejected the request${reason ? ` (${reason})` : ""}: ${message}.`,
      response.status,
    );
  }

  private assertCredentials(credentials: GeminiCredentials) {
    if (!credentials.apiKey || !credentials.apiSecret)
      throw new GeminiApiError(
        "credential_missing",
        "Gemini API key and secret are required.",
        401,
      );
    if (credentials.apiKey.length > 512 || credentials.apiSecret.length > 512)
      throw new GeminiApiError(
        "provider_validation_error",
        "Gemini credentials are invalid.",
      );
  }

  private nextNonce(apiKey: string) {
    const key = createHash("sha256").update(apiKey).digest("hex");
    const now = Date.now();
    const previous = this.nonces.get(key) ?? 0;
    const next = Math.max(now, previous + 1);
    this.nonces.set(key, next);
    if (this.nonces.size > 1_000)
      this.nonces.delete(this.nonces.keys().next().value!);
    return next;
  }

  private symbol(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^[A-Za-z0-9]{5,20}$/.test(value) ||
      /PERP$/i.test(value)
    )
      throw new GeminiApiError(
        "provider_validation_error",
        "Gemini symbol must be an exact spot symbol such as BTCUSD; perpetual symbols are unavailable.",
      );
    return value.toLowerCase();
  }

  private orderId(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^[0-9]{1,16}$/.test(value) ||
      !Number.isSafeInteger(Number(value))
    )
      throw new GeminiApiError(
        "provider_validation_error",
        "Gemini order ID must be a numeric string.",
      );
    return Number(value);
  }

  private decimal(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !/^[0-9]+(?:\.[0-9]{1,18})?$/.test(value) ||
      Number(value) <= 0 ||
      value.length > 40
    )
      throw new GeminiApiError(
        "provider_validation_error",
        `Gemini ${label} must be a positive decimal string.`,
      );
    return value;
  }

  private interval(value: unknown) {
    if (value === undefined) return "1h";
    const allowed = ["1m", "5m", "15m", "30m", "1h", "6h", "1d"];
    if (typeof value !== "string" || !allowed.includes(value))
      throw new GeminiApiError(
        "provider_validation_error",
        "Gemini candle interval is unsupported.",
      );
    return value;
  }

  private optionalClientOrderId(value: unknown) {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value))
      throw new GeminiApiError(
        "provider_validation_error",
        "Gemini client order ID is invalid.",
      );
    return value;
  }

  private enumValue(value: unknown, values: string[], label: string) {
    if (typeof value !== "string" || !values.includes(value))
      throw new GeminiApiError(
        "provider_validation_error",
        `Gemini ${label} is invalid.`,
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
        /(api.?key|signature|secret|password|credential|otp|cookie|authorization|payload)/i.test(
          key,
        )
      )
        output[key] = "[REDACTED]";
      else output[key] = this.redact(item);
    }
    return output;
  }
}
