export type QuickBooksEnvironment = "sandbox" | "production";
export type QuickBooksApiCredentials = {
  accessToken: string;
  realmId: string;
  environment: QuickBooksEnvironment;
};
export class QuickBooksApiError extends Error {
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
const REALM_ID = /^[1-9][0-9]{0,31}$/;
const ENTITY_ID = /^[1-9][0-9]{0,31}$/;
const COUNTRY_CODE = /^[A-Z]{2}$/;
const PAYMENT_CHARGE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const PAYROLL_COMPENSATIONS_QUERY = `query getEmployeeCompensations($filter: Payroll_EmployeeCompensationsFilter!) {
  payrollEmployeeCompensations(filter: $filter) {
    edges {
      node {
        id
        active
        employerCompensation {
          id
          name
          type {
            key
            description
            value
          }
        }
      }
    }
  }
}`;

export class QuickBooksApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}
  async health(credentials: QuickBooksApiCredentials) {
    return this.getCompanyInfo(credentials);
  }
  async getCompanyInfo(credentials: QuickBooksApiCredentials) {
    const body = await this.get(
      credentials,
      `/companyinfo/${encodeURIComponent(credentials.realmId)}`,
      new URLSearchParams(),
    );
    return {
      realmId: credentials.realmId,
      environment: credentials.environment,
      companyInfo: this.company(body.CompanyInfo),
    };
  }
  async listInvoices(
    credentials: QuickBooksApiCredentials,
    input: Record<string, unknown>,
  ) {
    const startPosition = this.integer(
      input.startPosition,
      "startPosition",
      1,
      10000,
      1,
    );
    const limit = this.integer(input.limit, "limit", 1, 25, 10);
    const statement = `SELECT * FROM Invoice ORDERBY MetaData.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${limit}`;
    const body = await this.get(
      credentials,
      "/query",
      new URLSearchParams({ query: statement }),
    );
    const response = this.object(body.QueryResponse);
    const invoices = Array.isArray(response.Invoice) ? response.Invoice : [];
    return {
      realmId: credentials.realmId,
      startPosition,
      invoices: invoices.slice(0, limit).map((value) => this.invoice(value)),
    };
  }
  async getInvoice(
    credentials: QuickBooksApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (typeof input.invoiceId !== "string" || !ENTITY_ID.test(input.invoiceId))
      throw new QuickBooksApiError(
        "quickbooks_invoice_id_invalid",
        "A positive numeric QuickBooks invoice ID is required.",
      );
    const body = await this.get(
      credentials,
      `/invoice/${encodeURIComponent(input.invoiceId)}`,
      new URLSearchParams(),
    );
    return {
      realmId: credentials.realmId,
      invoice: this.invoice(body.Invoice),
    };
  }
  async listPayrollCompensations(
    credentials: QuickBooksApiCredentials,
    input: Record<string, unknown>,
  ) {
    this.validateCredentials(credentials);
    if (credentials.environment !== "production")
      throw new QuickBooksApiError(
        "quickbooks_payroll_production_required",
        "QuickBooks Payroll Compensation is available only with production keys.",
      );
    if (
      typeof input.employeeId !== "string" ||
      !ENTITY_ID.test(input.employeeId)
    )
      throw new QuickBooksApiError(
        "quickbooks_employee_id_invalid",
        "A positive numeric QuickBooks employee ID is required.",
      );
    if (
      input.countryCode !== undefined &&
      (typeof input.countryCode !== "string" ||
        !COUNTRY_CODE.test(input.countryCode))
    )
      throw new QuickBooksApiError(
        "quickbooks_country_code_invalid",
        "QuickBooks countryCode must be an uppercase two-letter code.",
      );
    if (input.activeOnly !== undefined && typeof input.activeOnly !== "boolean")
      throw new QuickBooksApiError(
        "quickbooks_input_invalid",
        "QuickBooks activeOnly must be a boolean.",
      );
    const body = await this.graphql(
      credentials,
      PAYROLL_COMPENSATIONS_QUERY,
      {
        filter: {
          employeeId: input.employeeId,
          active: input.activeOnly ?? true,
        },
      },
      typeof input.countryCode === "string" ? input.countryCode : undefined,
    );
    const data = this.object(body.data);
    const connection = this.object(data.payrollEmployeeCompensations);
    const edges = Array.isArray(connection.edges) ? connection.edges : [];
    return {
      realmId: credentials.realmId,
      compensations: edges.slice(0, 10).map((edge) => {
        const node = this.object(this.object(edge).node);
        const compensation = this.object(node.employerCompensation);
        const type = this.object(compensation.type);
        return {
          id: this.scalar(node.id),
          active: this.scalar(node.active),
          employerCompensation: {
            id: this.scalar(compensation.id),
            name: this.scalar(compensation.name),
            type: {
              key: this.scalar(type.key),
              description: this.scalar(type.description),
              value: this.scalar(type.value),
            },
          },
        };
      }),
    };
  }
  async getPaymentCharge(
    credentials: QuickBooksApiCredentials,
    input: Record<string, unknown>,
  ) {
    this.validateCredentials(credentials);
    if (
      typeof input.chargeId !== "string" ||
      !PAYMENT_CHARGE_ID.test(input.chargeId)
    )
      throw new QuickBooksApiError(
        "quickbooks_payment_charge_id_invalid",
        "A valid QuickBooks Payments charge ID is required.",
      );
    const host =
      credentials.environment === "sandbox"
        ? "sandbox.api.intuit.com"
        : "api.intuit.com";
    const body = await this.paymentGet(
      credentials,
      `https://${host}/quickbooks/v4/payments/charges/${encodeURIComponent(input.chargeId)}`,
    );
    return {
      realmId: credentials.realmId,
      charge: {
        id: this.scalar(body.id),
        status: this.scalar(body.status),
        amount: this.scalar(body.amount),
        currency: this.scalar(body.currency),
        created: this.scalar(body.created),
        capture: this.scalar(body.capture),
      },
    };
  }
  private validateCredentials(credentials: QuickBooksApiCredentials) {
    if (!REALM_ID.test(credentials.realmId))
      throw new QuickBooksApiError(
        "quickbooks_realm_binding_invalid",
        "QuickBooks connection is not bound to a valid company.",
      );
    if (!credentials.accessToken.trim())
      throw new QuickBooksApiError(
        "quickbooks_token_invalid",
        "QuickBooks connection token is missing.",
      );
    if (!["sandbox", "production"].includes(credentials.environment))
      throw new QuickBooksApiError(
        "quickbooks_environment_invalid",
        "QuickBooks environment is invalid.",
      );
  }
  private async graphql(
    credentials: QuickBooksApiCredentials,
    query: string,
    variables: Record<string, unknown>,
    countryCode?: string,
  ) {
    let response: Response;
    try {
      response = await this.request("https://qb.api.intuit.com/graphql", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          ...(countryCode ? { intuit_country: countryCode } : {}),
        },
        body: JSON.stringify({ query, variables }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new QuickBooksApiError(
        "quickbooks_unavailable",
        "QuickBooks is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new QuickBooksApiError(
        "quickbooks_response_too_large",
        "QuickBooks response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new QuickBooksApiError(
        "quickbooks_response_invalid",
        "QuickBooks returned an invalid response.",
      );
    }
    const errors = Array.isArray(body.errors) ? body.errors : [];
    if (!response.ok || errors.length)
      throw new QuickBooksApiError(
        response.status === 401
          ? "quickbooks_token_invalid"
          : response.status === 403
            ? "quickbooks_permission_denied"
            : response.status === 429
              ? "quickbooks_rate_limited"
              : errors.length
                ? "quickbooks_graphql_error"
                : "quickbooks_http_error",
        "QuickBooks Payroll Compensation API request failed.",
        response.status,
        {
          providerError: errors.slice(0, 3).map((value) => {
            const error = this.object(value);
            return { code: this.scalar(this.object(error.extensions).code) };
          }),
          intuitTid: response.headers.get("intuit_tid"),
          retryAfter: response.headers.get("retry-after"),
        },
      );
    return body;
  }
  private async paymentGet(
    credentials: QuickBooksApiCredentials,
    url: string,
  ) {
    let response: Response;
    try {
      response = await this.request(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new QuickBooksApiError(
        "quickbooks_unavailable",
        "QuickBooks is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new QuickBooksApiError(
        "quickbooks_response_too_large",
        "QuickBooks response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new QuickBooksApiError(
        "quickbooks_response_invalid",
        "QuickBooks returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new QuickBooksApiError(
        response.status === 401
          ? "quickbooks_token_invalid"
          : response.status === 403
            ? "quickbooks_permission_denied"
            : response.status === 429
              ? "quickbooks_rate_limited"
              : "quickbooks_http_error",
        "QuickBooks Payments API request failed.",
        response.status,
        {
          providerError: Array.isArray(body.errors)
            ? body.errors.slice(0, 3).map((value) => ({
                code: this.scalar(this.object(value).code),
                type: this.scalar(this.object(value).type),
              }))
            : [],
          intuitTid: response.headers.get("intuit_tid"),
          retryAfter: response.headers.get("retry-after"),
        },
      );
    return body;
  }
  private async get(
    credentials: QuickBooksApiCredentials,
    path: string,
    query: URLSearchParams,
  ) {
    this.validateCredentials(credentials);
    const host =
      credentials.environment === "sandbox"
        ? "sandbox-quickbooks.api.intuit.com"
        : "quickbooks.api.intuit.com";
    const url = new URL(
      `https://${host}/v3/company/${credentials.realmId}${path}`,
    );
    query.set("minorversion", "75");
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
      throw new QuickBooksApiError(
        "quickbooks_unavailable",
        "QuickBooks is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new QuickBooksApiError(
        "quickbooks_response_too_large",
        "QuickBooks response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new QuickBooksApiError(
        "quickbooks_response_invalid",
        "QuickBooks returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new QuickBooksApiError(
        response.status === 401
          ? "quickbooks_token_invalid"
          : response.status === 403
            ? "quickbooks_permission_denied"
            : response.status === 429
              ? "quickbooks_rate_limited"
              : "quickbooks_http_error",
        "QuickBooks Online Accounting API request failed.",
        response.status,
        {
          providerError: this.errorSummary(body),
          intuitTid: response.headers.get("intuit_tid"),
          retryAfter: response.headers.get("retry-after"),
        },
      );
    return body;
  }
  private invoice(value: unknown) {
    const body = this.object(value);
    const currency = this.object(body.CurrencyRef);
    const metadata = this.object(body.MetaData);
    return {
      Id: this.scalar(body.Id),
      SyncToken: this.scalar(body.SyncToken),
      DocNumber: this.scalar(body.DocNumber),
      TxnDate: this.scalar(body.TxnDate),
      DueDate: this.scalar(body.DueDate),
      CurrencyCode: this.scalar(currency.value),
      TotalAmt: this.scalar(body.TotalAmt),
      Balance: this.scalar(body.Balance),
      EmailStatus: this.scalar(body.EmailStatus),
      PrintStatus: this.scalar(body.PrintStatus),
      LastUpdatedTime: this.scalar(metadata.LastUpdatedTime),
    };
  }
  private company(value: unknown) {
    const body = this.object(value);
    const country = this.object(body.Country);
    return {
      Id: this.scalar(body.Id),
      CompanyName: this.scalar(body.CompanyName),
      LegalName: this.scalar(body.LegalName),
      Country: this.scalar(country.value ?? body.Country),
      FiscalYearStartMonth: this.scalar(body.FiscalYearStartMonth),
      SupportedLanguages: this.scalar(body.SupportedLanguages),
    };
  }
  private errorSummary(body: Record<string, unknown>) {
    const fault = this.object(body.Fault);
    const errors = Array.isArray(fault.Error) ? fault.Error : [];
    return errors.slice(0, 3).map((value) => {
      const error = this.object(value);
      return {
        code: this.scalar(error.code),
        element: this.scalar(error.element),
      };
    });
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
      throw new QuickBooksApiError(
        "quickbooks_input_invalid",
        `QuickBooks ${field} is outside the supported range.`,
      );
    return Number(value);
  }
}
