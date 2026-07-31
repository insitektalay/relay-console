import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type PayPalEnvironment = "sandbox" | "live";
export type PayPalCredentials = {
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
};

export class PayPalApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class PayPalApiAdapter {
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number; scopes: string[] }
  >();

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: PayPalCredentials) {
    const token = await this.accessToken(credentials);
    return {
      environment: credentials.environment,
      tokenValid: true,
      grantedScopes: token.scopes,
    };
  }

  async listTransactions(
    credentials: PayPalCredentials,
    input: JsonObject,
  ) {
    const range = this.dateRange(input.startDate, input.endDate);
    const page = this.integer(input.page, "page", 1, 10_000, 1);
    const pageSize = this.integer(
      input.maxResults,
      "maxResults",
      1,
      25,
      25,
    );
    const query = new URLSearchParams({
      start_date: range.start,
      end_date: range.end,
      fields: "transaction_info",
      balance_affecting_records_only: "Y",
      page: String(page),
      page_size: String(pageSize),
    });
    const status = this.optionalString(input.status);
    if (status) {
      if (!new Set(["D", "P", "S", "V"]).has(status))
        throw this.invalid("PayPal transaction status is invalid.");
      query.set("transaction_status", status);
    }
    const currency = this.optionalString(input.currency);
    if (currency) {
      if (!/^[A-Z]{3}$/.test(currency))
        throw this.invalid("PayPal currency must be a three-letter code.");
      query.set("transaction_currency", currency);
    }
    const body = await this.get(
      credentials,
      `/v1/reporting/transactions?${query}`,
    );
    return this.transactions(body, pageSize);
  }

  async getTransaction(
    credentials: PayPalCredentials,
    input: JsonObject,
  ) {
    const transactionId = this.id(
      input.transactionId,
      "transactionId",
      /^[A-Za-z0-9_-]{17,24}$/,
    );
    const range = this.dateRange(input.startDate, input.endDate);
    const query = new URLSearchParams({
      start_date: range.start,
      end_date: range.end,
      transaction_id: transactionId,
      fields: "transaction_info",
      balance_affecting_records_only: "N",
      page: "1",
      page_size: "25",
    });
    const body = await this.get(
      credentials,
      `/v1/reporting/transactions?${query}`,
    );
    return { transactionId, ...this.transactions(body, 25) };
  }

  async getOrder(credentials: PayPalCredentials, input: JsonObject) {
    const orderId = this.id(input.orderId, "orderId", /^[A-Z0-9]{1,36}$/);
    const body = await this.get(
      credentials,
      `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    );
    return { order: this.order(body) };
  }

  async getCapture(credentials: PayPalCredentials, input: JsonObject) {
    const captureId = this.id(
      input.captureId,
      "captureId",
      /^[A-Za-z0-9_-]{1,64}$/,
    );
    const body = await this.get(
      credentials,
      `/v2/payments/captures/${encodeURIComponent(captureId)}`,
    );
    return { capture: this.capture(body) };
  }

  private async get(credentials: PayPalCredentials, path: string) {
    const origin = this.origin(credentials.environment);
    const url = new URL(path, origin);
    if (url.origin !== origin)
      throw new PayPalApiError(
        "policy_blocked",
        "PayPal request left its configured environment boundary.",
        403,
      );
    const token = await this.accessToken(credentials);
    return await this.fetchJson(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_GB",
        Authorization: `Bearer ${token.accessToken}`,
        "PayPal-Enforce-ISO8601-Format": "true",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  }

  private async accessToken(credentials: PayPalCredentials) {
    this.requireCredentials(credentials);
    const key = createHash("sha256")
      .update(
        `${credentials.environment}\0${credentials.clientId}\0${credentials.clientSecret}`,
      )
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
    const origin = this.origin(credentials.environment);
    const authorization = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
      "utf8",
    ).toString("base64");
    const body = await this.fetchJson(`${origin}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const accessToken = this.string(body.access_token);
    const expiresIn = this.number(body.expires_in);
    if (!accessToken || !expiresIn || expiresIn < 1)
      throw new PayPalApiError(
        "token_refresh_failed",
        "PayPal did not return a usable access token.",
      );
    const value = {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 32_400) * 1_000,
      scopes: this.string(body.scope)?.split(/\s+/).filter(Boolean) ?? [],
    };
    this.tokens.set(key, value);
    return value;
  }

  private async fetchJson(url: string, init: RequestInit): Promise<JsonObject> {
    let response: Response;
    try {
      response = await this.request(url, init);
    } catch {
      throw new PayPalApiError(
        "provider_unavailable",
        "PayPal is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new PayPalApiError(
        "provider_validation_error",
        "PayPal response exceeded the safe size limit.",
      );
    let body: JsonObject = {};
    try {
      const parsed = raw.length ? JSON.parse(raw.toString("utf8")) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new PayPalApiError(
        "provider_validation_error",
        "PayPal returned an invalid response.",
      );
    }
    if (!response.ok) {
      throw new PayPalApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "PayPal API request failed.",
        response.status,
        {
          providerError: {
            name: this.scalar(body.name),
            issue: this.scalar(this.object(this.array(body.details)[0])?.issue),
          },
          retryAfter: response.headers.get("retry-after"),
        },
      );
    }
    return body;
  }

  private transactions(body: JsonObject, limit: number) {
    return {
      transactions: this.array(body.transaction_details)
        .slice(0, limit)
        .map((value) => this.transaction(value)),
      page: this.integerScalar(body.page),
      totalItems: this.integerScalar(body.total_items),
      totalPages: this.integerScalar(body.total_pages),
      startDate: this.scalar(body.start_date),
      endDate: this.scalar(body.end_date),
    };
  }

  private transaction(value: unknown) {
    const info = this.object(this.object(value)?.transaction_info) ?? {};
    return {
      transactionId: this.scalar(info.transaction_id),
      referenceId: this.scalar(info.paypal_reference_id),
      referenceType: this.scalar(info.paypal_reference_id_type),
      eventCode: this.scalar(info.transaction_event_code),
      status: this.scalar(info.transaction_status),
      initiatedAt: this.scalar(info.transaction_initiation_date),
      updatedAt: this.scalar(info.transaction_updated_date),
      amount: this.money(info.transaction_amount),
      fee: this.money(info.fee_amount),
      net: this.money(info.net_amount),
      protectionEligibility: this.scalar(info.protection_eligibility),
    };
  }

  private order(body: JsonObject) {
    return {
      id: this.scalar(body.id),
      status: this.scalar(body.status),
      intent: this.scalar(body.intent),
      createTime: this.scalar(body.create_time),
      updateTime: this.scalar(body.update_time),
      purchaseUnits: this.array(body.purchase_units)
        .slice(0, 10)
        .map((value) => {
          const unit = this.object(value) ?? {};
          const payments = this.object(unit.payments) ?? {};
          return {
            referenceId: this.scalar(unit.reference_id),
            amount: this.money(unit.amount),
            authorizationStatuses: this.array(payments.authorizations)
              .slice(0, 10)
              .map((entry) => this.paymentStatus(entry)),
            captureStatuses: this.array(payments.captures)
              .slice(0, 10)
              .map((entry) => this.paymentStatus(entry)),
            refundStatuses: this.array(payments.refunds)
              .slice(0, 10)
              .map((entry) => this.paymentStatus(entry)),
          };
        }),
    };
  }

  private capture(body: JsonObject) {
    return {
      id: this.scalar(body.id),
      status: this.scalar(body.status),
      amount: this.money(body.amount),
      finalCapture:
        typeof body.final_capture === "boolean" ? body.final_capture : null,
      createTime: this.scalar(body.create_time),
      updateTime: this.scalar(body.update_time),
      sellerProtectionStatus: this.scalar(
        this.object(body.seller_protection)?.status,
      ),
    };
  }

  private paymentStatus(value: unknown) {
    const body = this.object(value) ?? {};
    return {
      id: this.scalar(body.id),
      status: this.scalar(body.status),
      amount: this.money(body.amount),
      createTime: this.scalar(body.create_time),
      updateTime: this.scalar(body.update_time),
    };
  }

  private money(value: unknown) {
    const body = this.object(value);
    return body
      ? {
          currencyCode: this.scalar(body.currency_code),
          value: this.scalar(body.value),
        }
      : null;
  }

  private dateRange(startValue: unknown, endValue: unknown) {
    const start = this.dateTime(startValue, "startDate");
    const end = this.dateTime(endValue, "endDate");
    const duration = Date.parse(end) - Date.parse(start);
    if (duration <= 0 || duration > 31 * 24 * 60 * 60 * 1_000)
      throw this.invalid(
        "PayPal date range must be positive and no longer than thirty-one days.",
      );
    return { start, end };
  }

  private dateTime(value: unknown, field: string) {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
      throw this.invalid(`PayPal ${field} must be an ISO 8601 date-time.`);
    return new Date(value).toISOString();
  }

  private id(value: unknown, field: string, pattern: RegExp) {
    if (typeof value !== "string" || !pattern.test(value))
      throw this.invalid(`PayPal ${field} is invalid.`);
    return value;
  }

  private integer(
    value: unknown,
    field: string,
    minimum: number,
    maximum: number,
    fallback: number,
  ) {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum)
      throw this.invalid(`PayPal ${field} is outside the supported range.`);
    return Number(value);
  }

  private requireCredentials(credentials: PayPalCredentials) {
    if (!credentials.clientId.trim() || !credentials.clientSecret.trim())
      throw new PayPalApiError(
        "credential_missing",
        "PayPal client credentials are missing.",
      );
    this.origin(credentials.environment);
  }

  private origin(environment: PayPalEnvironment) {
    if (environment === "sandbox") return "https://api-m.sandbox.paypal.com";
    if (environment === "live") return "https://api-m.paypal.com";
    throw this.invalid("PayPal environment must be sandbox or live.");
  }

  private invalid(message: string) {
    return new PayPalApiError("provider_validation_error", message);
  }
  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private string(value: unknown): string | null {
    return typeof value === "string" && value.length <= 16_000 ? value : null;
  }
  private optionalString(value: unknown): string | null {
    return value === undefined || value === null ? null : this.string(value);
  }
  private number(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return String(value.slice(0, 256));
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  private integerScalar(value: unknown): number | null {
    return Number.isSafeInteger(value) ? Number(value) : null;
  }
}
