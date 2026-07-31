export type XeroApiCredentials = { accessToken: string; tenantId: string };
export class XeroApiError extends Error {
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
const ORIGIN = "https://api.xero.com/api.xro/2.0";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set([
  "DRAFT",
  "SUBMITTED",
  "AUTHORISED",
  "PAID",
  "VOIDED",
  "DELETED",
]);

export class XeroApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}
  async health(credentials: XeroApiCredentials) {
    return this.getOrganisation(credentials);
  }
  async getOrganisation(credentials: XeroApiCredentials) {
    const body = await this.get(
      credentials,
      "/Organisation",
      new URLSearchParams(),
    );
    const values = Array.isArray(body.Organisations) ? body.Organisations : [];
    return {
      tenantId: credentials.tenantId,
      organisation: this.organisation(values[0]),
    };
  }
  async listInvoices(
    credentials: XeroApiCredentials,
    input: Record<string, unknown>,
  ) {
    const page = this.integer(input.page, "page", 1, 10000, 1);
    const limit = this.integer(input.limit, "limit", 1, 25, 10);
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(limit),
      order: "UpdatedDateUTC DESC",
      summaryOnly: "true",
    });
    if (input.status !== undefined) {
      if (typeof input.status !== "string" || !STATUSES.has(input.status))
        throw new XeroApiError(
          "xero_invoice_status_invalid",
          "Xero invoice status is invalid.",
        );
      query.set("Statuses", input.status);
    }
    const body = await this.get(credentials, "/Invoices", query);
    const values = Array.isArray(body.Invoices) ? body.Invoices : [];
    return {
      tenantId: credentials.tenantId,
      page,
      invoices: values.slice(0, limit).map((value) => this.invoice(value)),
    };
  }
  async getInvoice(
    credentials: XeroApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (typeof input.invoiceId !== "string" || !UUID.test(input.invoiceId))
      throw new XeroApiError(
        "xero_invoice_id_invalid",
        "A valid Xero invoice UUID is required.",
      );
    const body = await this.get(
      credentials,
      `/Invoices/${encodeURIComponent(input.invoiceId)}`,
      new URLSearchParams(),
    );
    const values = Array.isArray(body.Invoices) ? body.Invoices : [];
    return { tenantId: credentials.tenantId, invoice: this.invoice(values[0]) };
  }
  private async get(
    credentials: XeroApiCredentials,
    path: string,
    query: URLSearchParams,
  ) {
    if (!UUID.test(credentials.tenantId))
      throw new XeroApiError(
        "xero_tenant_binding_invalid",
        "Xero connection is not bound to a valid organisation.",
      );
    if (!credentials.accessToken.trim())
      throw new XeroApiError(
        "xero_token_invalid",
        "Xero connection token is missing.",
      );
    const url = new URL(`${ORIGIN}${path}`);
    url.search = query.toString();
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "xero-tenant-id": credentials.tenantId,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new XeroApiError(
        "xero_unavailable",
        "Xero is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new XeroApiError(
        "xero_response_too_large",
        "Xero response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new XeroApiError(
        "xero_response_invalid",
        "Xero returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new XeroApiError(
        response.status === 401
          ? "xero_token_invalid"
          : response.status === 403
            ? "xero_permission_denied"
            : response.status === 429
              ? "xero_rate_limited"
              : "xero_http_error",
        "Xero API request failed.",
        response.status,
        {
          providerError: {
            type: this.scalar(body.Type ?? body.type),
            status: this.scalar(body.Status ?? body.status),
            errorNumber: this.scalar(body.ErrorNumber),
          },
          retryAfter: response.headers.get("retry-after"),
        },
      );
    return body;
  }
  private invoice(value: unknown) {
    const body = this.object(value);
    const contact = this.object(body.Contact);
    return {
      InvoiceID: this.scalar(body.InvoiceID),
      InvoiceNumber: this.scalar(body.InvoiceNumber),
      Type: this.scalar(body.Type),
      Status: this.scalar(body.Status),
      Date: this.scalar(body.Date),
      DueDate: this.scalar(body.DueDate),
      CurrencyCode: this.scalar(body.CurrencyCode),
      SubTotal: this.scalar(body.SubTotal),
      TotalTax: this.scalar(body.TotalTax),
      Total: this.scalar(body.Total),
      AmountDue: this.scalar(body.AmountDue),
      AmountPaid: this.scalar(body.AmountPaid),
      AmountCredited: this.scalar(body.AmountCredited),
      UpdatedDateUTC: this.scalar(body.UpdatedDateUTC),
      HasAttachments: this.scalar(body.HasAttachments),
      ContactID: this.scalar(contact.ContactID),
    };
  }
  private organisation(value: unknown) {
    const body = this.object(value);
    return {
      OrganisationID: this.scalar(body.OrganisationID),
      Name: this.scalar(body.Name),
      LegalName: this.scalar(body.LegalName),
      BaseCurrency: this.scalar(body.BaseCurrency),
      CountryCode: this.scalar(body.CountryCode),
      Version: this.scalar(body.Version),
      OrganisationType: this.scalar(body.OrganisationType),
      PaysTax: this.scalar(body.PaysTax),
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
      throw new XeroApiError(
        "xero_input_invalid",
        `Xero ${field} is outside the supported range.`,
      );
    return Number(value);
  }
}
