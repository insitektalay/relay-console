export type WaveApiCredentials = {
  accessToken: string;
  businessId: string;
};

export class WaveApiError extends Error {
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
const OPAQUE_ID = /^[A-Za-z0-9+/=_-]{1,256}$/;
const ENDPOINT = "https://gql.waveapps.com/graphql/public";
const BUSINESS_QUERY =
  "query RelayWaveBusiness($businessId: ID!) { business(id: $businessId) { id name isPersonal } }";
const INVOICE_FIELDS =
  "id status invoiceNumber invoiceDate dueDate createdAt modifiedAt amountDue { value currency { code } } amountPaid { value currency { code } } total { value currency { code } } customer { id }";
const INVOICE_LIST_QUERY = `query RelayWaveInvoices($businessId: ID!, $page: Int!, $pageSize: Int!) { business(id: $businessId) { id invoices(page: $page, pageSize: $pageSize, sort: [MODIFIED_AT_DESC]) { pageInfo { currentPage totalPages totalCount } edges { node { ${INVOICE_FIELDS} } } } } }`;
const INVOICE_GET_QUERY = `query RelayWaveInvoice($businessId: ID!, $invoiceId: ID!) { business(id: $businessId) { id invoice(id: $invoiceId) { ${INVOICE_FIELDS} } } }`;

export class WaveApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: WaveApiCredentials) {
    return this.getConnectedBusiness(credentials);
  }

  async getConnectedBusiness(credentials: WaveApiCredentials) {
    const data = await this.graph(credentials, BUSINESS_QUERY, {
      businessId: credentials.businessId,
    });
    const business = this.object(data.business);
    if (this.scalar(business.id) !== credentials.businessId)
      throw new WaveApiError(
        "wave_business_binding_mismatch",
        "Wave token is not valid for the connected business.",
      );
    return { business: this.business(business) };
  }

  async listInvoices(
    credentials: WaveApiCredentials,
    input: Record<string, unknown>,
  ) {
    const page = this.integer(input.page, "page", 1, 10000, 1);
    const limit = this.integer(input.limit, "limit", 1, 25, 10);
    const data = await this.graph(credentials, INVOICE_LIST_QUERY, {
      businessId: credentials.businessId,
      page,
      pageSize: limit,
    });
    const business = this.object(data.business);
    if (this.scalar(business.id) !== credentials.businessId)
      throw new WaveApiError(
        "wave_business_binding_mismatch",
        "Wave response did not match the connected business.",
      );
    const invoices = this.object(business.invoices);
    const edges = Array.isArray(invoices.edges) ? invoices.edges : [];
    return {
      businessId: credentials.businessId,
      page,
      invoices: edges
        .slice(0, limit)
        .map((edge) => this.invoice(this.object(this.object(edge).node))),
      pageInfo: this.pageInfo(invoices.pageInfo),
    };
  }

  async getInvoice(
    credentials: WaveApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (typeof input.invoiceId !== "string" || !OPAQUE_ID.test(input.invoiceId))
      throw new WaveApiError(
        "wave_invoice_id_invalid",
        "A valid opaque Wave invoice ID is required.",
      );
    const data = await this.graph(credentials, INVOICE_GET_QUERY, {
      businessId: credentials.businessId,
      invoiceId: input.invoiceId,
    });
    const business = this.object(data.business);
    if (this.scalar(business.id) !== credentials.businessId)
      throw new WaveApiError(
        "wave_business_binding_mismatch",
        "Wave response did not match the connected business.",
      );
    return {
      businessId: credentials.businessId,
      invoice: this.invoice(this.object(business.invoice)),
    };
  }

  private async graph(
    credentials: WaveApiCredentials,
    query: string,
    variables: Record<string, unknown>,
  ) {
    if (!OPAQUE_ID.test(credentials.businessId))
      throw new WaveApiError(
        "wave_business_binding_invalid",
        "Wave connection is not bound to a valid business.",
      );
    if (!credentials.accessToken.trim())
      throw new WaveApiError(
        "wave_token_invalid",
        "Wave connection token is missing.",
      );
    let response: Response;
    try {
      response = await this.request(ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new WaveApiError(
        "wave_unavailable",
        "Wave is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new WaveApiError(
        "wave_response_too_large",
        "Wave response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new WaveApiError(
        "wave_response_invalid",
        "Wave returned an invalid response.",
      );
    }
    const errors = Array.isArray(body.errors) ? body.errors : [];
    if (!response.ok || errors.length)
      throw new WaveApiError(
        response.status === 401
          ? "wave_token_invalid"
          : response.status === 403
            ? "wave_permission_or_subscription_denied"
            : response.status === 429
              ? "wave_rate_limited"
              : "wave_graphql_error",
        "Wave Accounting request failed.",
        response.status,
        {
          retryAfter: response.headers.get("retry-after"),
          providerCode: this.graphqlErrorCode(errors[0]),
        },
      );
    return this.object(body.data);
  }

  private business(body: Record<string, unknown>) {
    return {
      businessId: this.scalar(body.id),
      name: this.scalar(body.name),
      isPersonal: body.isPersonal === true,
    };
  }

  private invoice(body: Record<string, unknown>) {
    return {
      invoiceId: this.scalar(body.id),
      status: this.scalar(body.status),
      invoiceNumber: this.scalar(body.invoiceNumber),
      invoiceDate: this.scalar(body.invoiceDate),
      dueDate: this.scalar(body.dueDate),
      createdAt: this.scalar(body.createdAt),
      modifiedAt: this.scalar(body.modifiedAt),
      amountDue: this.money(body.amountDue),
      amountPaid: this.money(body.amountPaid),
      total: this.money(body.total),
      customerId: this.scalar(this.object(body.customer).id),
    };
  }

  private money(value: unknown) {
    const body = this.object(value);
    return {
      value: this.scalar(body.value),
      currencyCode: this.scalar(this.object(body.currency).code),
    };
  }

  private pageInfo(value: unknown) {
    const body = this.object(value);
    return {
      currentPage: this.scalar(body.currentPage),
      totalPages: this.scalar(body.totalPages),
      totalCount: this.scalar(body.totalCount),
    };
  }

  private graphqlErrorCode(value: unknown) {
    const code = this.scalar(this.object(this.object(value).extensions).code);
    return typeof code === "string" ? code : null;
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
      throw new WaveApiError(
        "wave_input_invalid",
        `Wave ${field} is outside the supported range.`,
      );
    return Number(value);
  }
}
