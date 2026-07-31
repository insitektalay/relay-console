export type StripeApiCredentials = {
  accessToken: string;
  accountId: string;
  livemode: boolean;
};

export class StripeApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_ORIGIN = "https://api.stripe.com";
const API_VERSION = "2026-06-24.dahlia";
const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9]{1,125}$/;
const STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "canceled",
  "succeeded",
]);

export class StripeApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: StripeApiCredentials) {
    return this.getBalance(credentials);
  }

  async getBalance(credentials: StripeApiCredentials) {
    const body = await this.get(
      credentials,
      "/v1/balance",
      new URLSearchParams(),
    );
    return {
      accountId: credentials.accountId,
      livemode: this.boolean(body.livemode, credentials.livemode),
      available: this.moneyBuckets(body.available),
      pending: this.moneyBuckets(body.pending),
    };
  }

  async listPaymentIntents(
    credentials: StripeApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.integer(input.limit, "limit", 1, 25, 10);
    const query = new URLSearchParams({ limit: String(limit) });
    if (input.startingAfter !== undefined) {
      const cursor = this.paymentIntentId(input.startingAfter, "startingAfter");
      query.set("starting_after", cursor);
    }
    const createdGte = this.optionalInteger(input.createdGte, "createdGte");
    const createdLte = this.optionalInteger(input.createdLte, "createdLte");
    if (createdGte !== null) query.set("created[gte]", String(createdGte));
    if (createdLte !== null) query.set("created[lte]", String(createdLte));
    if (createdGte !== null && createdLte !== null && createdGte > createdLte) {
      throw new StripeApiError(
        "stripe_created_range_invalid",
        "Stripe created timestamp bounds are invalid.",
      );
    }
    const status = this.optionalString(input.status);
    if (status && !STATUSES.has(status)) {
      throw new StripeApiError(
        "stripe_status_invalid",
        "Stripe PaymentIntent status is invalid.",
      );
    }
    const body = await this.get(credentials, "/v1/payment_intents", query);
    const values = Array.isArray(body.data) ? body.data : [];
    return {
      accountId: credentials.accountId,
      livemode: credentials.livemode,
      paymentIntents: values
        .slice(0, limit)
        .map((value) => this.paymentIntent(value))
        .filter((value) => !status || value.status === status),
      hasMore: this.boolean(body.has_more, false),
    };
  }

  async getPaymentIntent(
    credentials: StripeApiCredentials,
    input: Record<string, unknown>,
  ) {
    const id = this.paymentIntentId(input.paymentIntentId, "paymentIntentId");
    const body = await this.get(
      credentials,
      `/v1/payment_intents/${encodeURIComponent(id)}`,
      new URLSearchParams(),
    );
    return {
      accountId: credentials.accountId,
      livemode: credentials.livemode,
      paymentIntent: this.paymentIntent(body),
    };
  }

  private async get(
    credentials: StripeApiCredentials,
    path: string,
    query: URLSearchParams,
  ) {
    if (!/^acct_[A-Za-z0-9]{1,125}$/.test(credentials.accountId)) {
      throw new StripeApiError(
        "stripe_account_binding_invalid",
        "Stripe connection is not bound to a valid account.",
      );
    }
    if (!credentials.accessToken.trim()) {
      throw new StripeApiError(
        "stripe_token_invalid",
        "Stripe connection token is missing.",
      );
    }
    const url = new URL(path, API_ORIGIN);
    url.search = query.toString();
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "Stripe-Version": API_VERSION,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new StripeApiError(
        "stripe_unavailable",
        "Stripe is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000) {
      throw new StripeApiError(
        "stripe_response_too_large",
        "Stripe response exceeded the safe size limit.",
      );
    }
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new StripeApiError(
        "stripe_response_invalid",
        "Stripe returned an invalid response.",
      );
    }
    if (!response.ok) {
      const error = this.object(body.error);
      throw new StripeApiError(
        response.status === 401
          ? "stripe_token_invalid"
          : response.status === 403
            ? "stripe_permission_denied"
            : response.status === 429
              ? "stripe_rate_limited"
              : "stripe_http_error",
        "Stripe API request failed.",
        response.status,
        {
          providerError: {
            type: this.scalar(error.type),
            code: this.scalar(error.code),
            declineCode: this.scalar(error.decline_code),
            param: this.scalar(error.param),
          },
          retryAfter: response.headers.get("retry-after"),
        },
      );
    }
    return body;
  }

  private paymentIntent(value: unknown) {
    const body = this.object(value);
    return {
      id: this.scalar(body.id),
      status: this.scalar(body.status),
      amount: this.integerScalar(body.amount),
      amountCapturable: this.integerScalar(body.amount_capturable),
      amountReceived: this.integerScalar(body.amount_received),
      currency: this.scalar(body.currency),
      captureMethod: this.scalar(body.capture_method),
      confirmationMethod: this.scalar(body.confirmation_method),
      created: this.integerScalar(body.created),
      canceledAt: this.integerScalar(body.canceled_at),
      cancellationReason: this.scalar(body.cancellation_reason),
      livemode: this.boolean(body.livemode, false),
      latestCharge: this.scalar(body.latest_charge),
    };
  }

  private moneyBuckets(value: unknown) {
    return (Array.isArray(value) ? value : []).slice(0, 30).map((entry) => {
      const body = this.object(entry);
      return {
        amount: this.integerScalar(body.amount),
        currency: this.scalar(body.currency),
      };
    });
  }

  private paymentIntentId(value: unknown, field: string) {
    if (typeof value !== "string" || !PAYMENT_INTENT_ID.test(value)) {
      throw new StripeApiError(
        "stripe_payment_intent_id_invalid",
        `Stripe ${field} must be a valid PaymentIntent ID.`,
      );
    }
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
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < minimum ||
      Number(value) > maximum
    ) {
      throw new StripeApiError(
        "stripe_input_invalid",
        `Stripe ${field} is outside the supported range.`,
      );
    }
    return Number(value);
  }

  private optionalInteger(value: unknown, field: string) {
    if (value === undefined || value === null) return null;
    if (!Number.isSafeInteger(value) || Number(value) < 1) {
      throw new StripeApiError(
        "stripe_input_invalid",
        `Stripe ${field} must be a positive integer.`,
      );
    }
    return Number(value);
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private optionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 256);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private integerScalar(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
  }

  private boolean(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
  }
}
