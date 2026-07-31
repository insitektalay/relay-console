import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash, createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type KrakenCredentials = { apiKey: string; apiSecret: string };

export class KrakenApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export function krakenSignature(
  path: string,
  nonce: string,
  encodedPayload: string,
  apiSecret: string,
) {
  let secret: Buffer;
  try {
    secret = Buffer.from(apiSecret, "base64");
  } catch {
    throw new KrakenApiError(
      "provider_validation_error",
      "Kraken private key must be valid base64.",
    );
  }
  if (
    !secret.length ||
    secret.toString("base64").replace(/=+$/, "") !==
      apiSecret.replace(/=+$/, "")
  )
    throw new KrakenApiError(
      "provider_validation_error",
      "Kraken private key must be valid base64.",
    );
  const digest = createHash("sha256")
    .update(`${nonce}${encodedPayload}`)
    .digest();
  return createHmac("sha512", secret)
    .update(Buffer.concat([Buffer.from(path), digest]))
    .digest("base64");
}

@Injectable()
export class KrakenApiAdapter {
  private readonly origin = "https://api.kraken.com";
  private readonly nonces = new Map<string, bigint>();

  async health(credentials: KrakenCredentials) {
    const data = await this.privateRequest(
      credentials,
      "/0/private/GetApiKeyInfo",
      {},
    );
    return this.redact(data);
  }

  async market(input: JsonObject) {
    const kind = this.enumValue(
      input.kind,
      ["ticker", "order_book", "ohlc"],
      "market kind",
    );
    const pair = this.pair(input.pair);
    const endpoint =
      kind === "ticker" ? "Ticker" : kind === "order_book" ? "Depth" : "OHLC";
    const url = new URL(`${this.origin}/0/public/${endpoint}`);
    url.searchParams.set("pair", pair);
    if (kind === "order_book") url.searchParams.set("count", "25");
    if (kind === "ohlc")
      url.searchParams.set("interval", String(this.interval(input.interval)));
    return this.publicRequest(url, kind);
  }

  async account(credentials: KrakenCredentials, input: JsonObject) {
    const kind = this.enumValue(
      input.kind,
      ["balances", "open_orders", "closed_orders", "trades", "ledgers"],
      "account read kind",
    );
    const routes: Record<string, string> = {
      balances: "/0/private/Balance",
      open_orders: "/0/private/OpenOrders",
      closed_orders: "/0/private/ClosedOrders",
      trades: "/0/private/TradesHistory",
      ledgers: "/0/private/Ledgers",
    };
    const offset = this.offset(input.offset);
    const payload =
      offset === undefined || ["balances", "open_orders"].includes(kind)
        ? {}
        : { ofs: String(offset) };
    const data = await this.privateRequest(credentials, routes[kind], payload);
    return this.boundResult(data, kind === "balances" ? 200 : 100);
  }

  async placeOrder(credentials: KrakenCredentials, input: JsonObject) {
    const pair = this.pair(input.pair);
    const side = this.enumValue(input.side, ["buy", "sell"], "order side");
    const orderType = this.enumValue(
      input.orderType,
      ["market", "limit"],
      "order type",
    );
    const volume = this.decimal(input.volume, "volume");
    const price =
      input.price === undefined
        ? undefined
        : this.decimal(input.price, "price");
    if (orderType === "limit" && !price)
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken limit orders require a price.",
      );
    if (orderType === "market" && price)
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken market orders cannot include a price.",
      );
    if (
      input.validateOnly !== undefined &&
      typeof input.validateOnly !== "boolean"
    )
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken validateOnly must be a boolean.",
      );
    return this.privateRequest(credentials, "/0/private/AddOrder", {
      pair,
      type: side,
      ordertype: orderType,
      volume,
      ...(price ? { price } : {}),
      ...(input.validateOnly === true ? { validate: "true" } : {}),
    });
  }

  async cancelOrder(credentials: KrakenCredentials, input: JsonObject) {
    if (
      typeof input.transactionId !== "string" ||
      !/^[A-Za-z0-9-]{6,64}$/.test(input.transactionId)
    )
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken transaction ID is invalid.",
      );
    return this.privateRequest(credentials, "/0/private/CancelOrder", {
      txid: input.transactionId,
    });
  }

  private async publicRequest(url: URL, kind: string) {
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new KrakenApiError(
        "provider_unavailable",
        "Kraken could not be reached.",
        502,
      );
    }
    const payload = await this.response(response);
    this.assertKrakenSuccess(payload, response.status);
    return this.boundResult(
      (payload as JsonObject).result,
      kind === "ticker" ? 50 : 100,
    );
  }

  private async privateRequest(
    credentials: KrakenCredentials,
    path: string,
    fields: Record<string, string>,
  ) {
    this.assertCredentials(credentials);
    const nonce = this.nextNonce(credentials.apiKey);
    const form = new URLSearchParams({ nonce, ...fields });
    const encoded = form.toString();
    const signature = krakenSignature(
      path,
      nonce,
      encoded,
      credentials.apiSecret,
    );
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.origin}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "API-Key": credentials.apiKey,
          "API-Sign": signature,
        },
        body: encoded,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new KrakenApiError(
        "provider_unavailable",
        "Kraken could not be reached.",
        502,
      );
    }
    const payload = await this.response(response);
    this.assertKrakenSuccess(payload, response.status);
    return this.redact((payload as JsonObject).result);
  }

  private async response(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_000_000)
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken response exceeds 2 MB.",
      );
    try {
      return raw.length ? (JSON.parse(raw.toString("utf8")) as unknown) : null;
    } catch {
      throw new KrakenApiError(
        "provider_unavailable",
        "Kraken returned an invalid response.",
        502,
      );
    }
  }

  private assertKrakenSuccess(payload: unknown, status: number) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new KrakenApiError(
        "provider_unavailable",
        `Kraken returned HTTP ${status}.`,
        status,
      );
    const errors = Array.isArray((payload as JsonObject).error)
      ? ((payload as JsonObject).error as unknown[]).filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
      : [];
    if (!errors.length && status >= 200 && status < 300) return;
    const joined = errors.join("; ").slice(0, 500) || `HTTP ${status}`;
    const code: MarketplaceConnectorSafeErrorCode =
      /rate limit|throttl|too many/i.test(joined)
        ? "provider_rate_limited"
        : /permission|denied/i.test(joined)
          ? "insufficient_scope"
          : /invalid key|invalid signature|unknown key/i.test(joined)
            ? "credential_missing"
            : /invalid nonce|invalid arguments?|invalid order|insufficient funds/i.test(
                  joined,
                )
              ? "provider_validation_error"
              : "provider_unavailable";
    throw new KrakenApiError(
      code,
      `Kraken rejected the request: ${joined}.`,
      status,
    );
  }

  private assertCredentials(credentials: KrakenCredentials) {
    if (!credentials.apiKey || !credentials.apiSecret)
      throw new KrakenApiError(
        "credential_missing",
        "Kraken API key and private key are required.",
        401,
      );
    if (credentials.apiKey.length > 512 || credentials.apiSecret.length > 512)
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken credentials are invalid.",
      );
  }

  private nextNonce(apiKey: string) {
    const key = createHash("sha256").update(apiKey).digest("hex");
    const current = BigInt(Date.now()) * 1_000n;
    const previous = this.nonces.get(key) ?? 0n;
    const next = current > previous ? current : previous + 1n;
    this.nonces.set(key, next);
    if (this.nonces.size > 1_000)
      this.nonces.delete(this.nonces.keys().next().value!);
    return next.toString();
  }

  private pair(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9./:-]{3,32}$/.test(value))
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken pair must be a valid spot pair symbol.",
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
      throw new KrakenApiError(
        "provider_validation_error",
        `Kraken ${label} must be a positive decimal string.`,
      );
    return value;
  }

  private interval(value: unknown) {
    if (value === undefined) return 60;
    const allowed = [1, 5, 15, 30, 60, 240, 1440, 10080, 21600];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      !allowed.includes(value)
    )
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken OHLC interval is unsupported.",
      );
    return value;
  }

  private offset(value: unknown) {
    if (value === undefined) return undefined;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 10_000
    )
      throw new KrakenApiError(
        "provider_validation_error",
        "Kraken offset must be an integer from 0 through 10000.",
      );
    return value;
  }

  private enumValue(value: unknown, values: string[], label: string) {
    if (typeof value !== "string" || !values.includes(value))
      throw new KrakenApiError(
        "provider_validation_error",
        `Kraken ${label} is invalid.`,
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
      } else if (item && typeof item === "object") {
        const entries = Object.entries(item as JsonObject);
        bounded[key] = Object.fromEntries(entries.slice(0, limit));
        if (entries.length > limit) bounded[`${key}Truncated`] = true;
      } else {
        bounded[key] = item;
      }
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
        /(api.?key|api.?sign|secret|password|credential|otp|cookie|authorization)/i.test(
          key,
        )
      )
        output[key] = "[REDACTED]";
      else output[key] = this.redact(item);
    }
    return output;
  }
}
