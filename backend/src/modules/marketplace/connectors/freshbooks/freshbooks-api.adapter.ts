export type FreshBooksApiCredentials = {
  accessToken: string;
  businessId: string;
  accountId: string;
  role: string;
};
export class FreshBooksApiError extends Error {
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
const BUSINESS_ID = /^[1-9][0-9]{0,31}$/;
const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ENTITY_ID = /^[1-9][0-9]{0,31}$/;

export class FreshBooksApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}
  async health(credentials: FreshBooksApiCredentials) {
    return this.getConnectedBusiness(credentials);
  }
  async getConnectedBusiness(credentials: FreshBooksApiCredentials) {
    const body = await this.get(
      credentials,
      "/auth/api/v1/users/me",
      new URLSearchParams(),
    );
    const response = this.object(body.response);
    const memberships = Array.isArray(response.business_memberships)
      ? response.business_memberships
      : [];
    const match = memberships
      .map((value) => this.membership(value))
      .find(
        (value) =>
          String(value.businessId) === credentials.businessId &&
          String(value.accountId) === credentials.accountId,
      );
    if (!match)
      throw new FreshBooksApiError(
        "freshbooks_business_binding_mismatch",
        "FreshBooks token is not valid for the connected business.",
      );
    return { businessMembership: match };
  }
  async listInvoices(
    credentials: FreshBooksApiCredentials,
    input: Record<string, unknown>,
  ) {
    const page = this.integer(input.page, "page", 1, 10000, 1);
    const limit = this.integer(input.limit, "limit", 1, 25, 10);
    const body = await this.get(
      credentials,
      `/accounting/account/${encodeURIComponent(credentials.accountId)}/invoices/invoices`,
      new URLSearchParams({
        page: String(page),
        per_page: String(limit),
        sort: "updated_desc",
      }),
    );
    const result = this.object(this.object(body.response).result);
    const invoices = Array.isArray(result.invoices) ? result.invoices : [];
    return {
      businessId: credentials.businessId,
      accountId: credentials.accountId,
      page,
      invoices: invoices.slice(0, limit).map((value) => this.invoice(value)),
    };
  }
  async getInvoice(
    credentials: FreshBooksApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (typeof input.invoiceId !== "string" || !ENTITY_ID.test(input.invoiceId))
      throw new FreshBooksApiError(
        "freshbooks_invoice_id_invalid",
        "A positive numeric FreshBooks invoice ID is required.",
      );
    const body = await this.get(
      credentials,
      `/accounting/account/${encodeURIComponent(credentials.accountId)}/invoices/invoices/${encodeURIComponent(input.invoiceId)}`,
      new URLSearchParams(),
    );
    const result = this.object(this.object(body.response).result);
    return {
      businessId: credentials.businessId,
      accountId: credentials.accountId,
      invoice: this.invoice(
        result.invoice ??
          (Array.isArray(result.invoices) ? result.invoices[0] : null),
      ),
    };
  }
  private async get(
    credentials: FreshBooksApiCredentials,
    path: string,
    query: URLSearchParams,
  ) {
    if (
      !BUSINESS_ID.test(credentials.businessId) ||
      !ACCOUNT_ID.test(credentials.accountId)
    )
      throw new FreshBooksApiError(
        "freshbooks_business_binding_invalid",
        "FreshBooks connection is not bound to a valid business and account.",
      );
    if (!credentials.accessToken.trim())
      throw new FreshBooksApiError(
        "freshbooks_token_invalid",
        "FreshBooks connection token is missing.",
      );
    const url = new URL(`https://api.freshbooks.com${path}`);
    url.search = query.toString();
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new FreshBooksApiError(
        "freshbooks_unavailable",
        "FreshBooks is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new FreshBooksApiError(
        "freshbooks_response_too_large",
        "FreshBooks response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new FreshBooksApiError(
        "freshbooks_response_invalid",
        "FreshBooks returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new FreshBooksApiError(
        response.status === 401
          ? "freshbooks_token_invalid"
          : response.status === 403
            ? "freshbooks_permission_denied"
            : response.status === 429
              ? "freshbooks_rate_limited"
              : "freshbooks_http_error",
        "FreshBooks API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }
  private membership(value: unknown) {
    const body = this.object(value);
    const business = this.object(body.business);
    return {
      businessId: this.scalar(business.id),
      accountId: this.scalar(business.account_id),
      businessName: this.scalar(business.name),
      role: this.scalar(body.role),
      active: business.active === true,
    };
  }
  private invoice(value: unknown) {
    const body = this.object(value),
      amount = this.object(body.amount),
      paid = this.object(body.paid),
      outstanding = this.object(body.outstanding);
    return {
      id: this.scalar(body.id ?? body.invoiceid),
      invoiceNumber: this.scalar(body.invoice_number),
      createDate: this.scalar(body.create_date),
      dueDate: this.scalar(body.due_date),
      updatedAt: this.scalar(body.updated ?? body.updated_at),
      displayStatus: this.scalar(body.display_status),
      paymentStatus: this.scalar(body.payment_status),
      currencyCode: this.scalar(body.currency_code ?? amount.code),
      amount: this.scalar(amount.amount),
      paid: this.scalar(paid.amount),
      outstanding: this.scalar(outstanding.amount),
    };
  }
  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  private integer(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback: number,
  ) {
    if (value === undefined) return fallback;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < min ||
      Number(value) > max
    )
      throw new FreshBooksApiError(
        "freshbooks_input_invalid",
        `FreshBooks ${field} is outside the supported range.`,
      );
    return Number(value);
  }
}
