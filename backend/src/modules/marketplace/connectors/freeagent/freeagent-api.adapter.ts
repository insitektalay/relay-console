export type FreeAgentApiCredentials = {
  accessToken: string;
  companyId: string;
};

export class FreeAgentApiError extends Error {
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
const ENTITY_ID = /^[1-9][0-9]{0,31}$/;
const VIEWS = new Set([
  "all",
  "recent_open_or_overdue",
  "open",
  "overdue",
  "open_or_overdue",
  "draft",
  "paid",
  "scheduled_to_email",
  "thank_you_emails",
  "reminder_emails",
]);

export class FreeAgentApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: FreeAgentApiCredentials) {
    return this.getConnectedCompany(credentials);
  }

  async getConnectedCompany(credentials: FreeAgentApiCredentials) {
    const body = await this.get(credentials, "/company", new URLSearchParams());
    const company = this.company(this.object(body.company));
    if (String(company.companyId) !== credentials.companyId)
      throw new FreeAgentApiError(
        "freeagent_company_binding_mismatch",
        "FreeAgent token is not valid for the connected company.",
      );
    return { company };
  }

  async listInvoices(
    credentials: FreeAgentApiCredentials,
    input: Record<string, unknown>,
  ) {
    const page = this.integer(input.page, "page", 1, 10000, 1);
    const view = this.view(input.view);
    const query = new URLSearchParams({ page: String(page), sort: "-updated_at" });
    if (view) query.set("view", view);
    const body = await this.get(credentials, "/invoices", query);
    const invoices = Array.isArray(body.invoices) ? body.invoices : [];
    return {
      companyId: credentials.companyId,
      page,
      view,
      invoices: invoices.slice(0, 25).map((value) => this.invoice(value)),
    };
  }

  async getInvoice(
    credentials: FreeAgentApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (typeof input.invoiceId !== "string" || !ENTITY_ID.test(input.invoiceId))
      throw new FreeAgentApiError(
        "freeagent_invoice_id_invalid",
        "A positive numeric FreeAgent invoice ID is required.",
      );
    const body = await this.get(
      credentials,
      `/invoices/${encodeURIComponent(input.invoiceId)}`,
      new URLSearchParams(),
    );
    return {
      companyId: credentials.companyId,
      invoice: this.invoice(body.invoice),
    };
  }

  private async get(
    credentials: FreeAgentApiCredentials,
    path: string,
    query: URLSearchParams,
  ) {
    if (!ENTITY_ID.test(credentials.companyId))
      throw new FreeAgentApiError(
        "freeagent_company_binding_invalid",
        "FreeAgent connection is not bound to a valid company.",
      );
    if (!credentials.accessToken.trim())
      throw new FreeAgentApiError(
        "freeagent_token_invalid",
        "FreeAgent connection token is missing.",
      );
    const url = new URL(`https://api.freeagent.com/v2${path}`);
    url.search = query.toString();
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "User-Agent": "RelayConsole-FreeAgent/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new FreeAgentApiError(
        "freeagent_unavailable",
        "FreeAgent is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new FreeAgentApiError(
        "freeagent_response_too_large",
        "FreeAgent response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new FreeAgentApiError(
        "freeagent_response_invalid",
        "FreeAgent returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new FreeAgentApiError(
        response.status === 401
          ? "freeagent_token_invalid"
          : response.status === 403
            ? "freeagent_permission_denied"
            : response.status === 429
              ? "freeagent_rate_limited"
              : "freeagent_http_error",
        "FreeAgent API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private company(body: Record<string, unknown>) {
    return {
      companyId: this.scalar(body.id),
      name: this.scalar(body.name),
      type: this.scalar(body.type),
      currency: this.scalar(body.currency),
    };
  }

  private invoice(value: unknown) {
    const body = this.object(value);
    return {
      invoiceId: this.idFromUrl(body.url),
      status: this.scalar(body.status),
      reference: this.scalar(body.reference),
      datedOn: this.scalar(body.dated_on),
      dueOn: this.scalar(body.due_on),
      currency: this.scalar(body.currency),
      netValue: this.scalar(body.net_value),
      totalValue: this.scalar(body.total_value),
      paidValue: this.scalar(body.paid_value),
      dueValue: this.scalar(body.due_value),
    };
  }

  private idFromUrl(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const id = new URL(value).pathname.split("/").filter(Boolean).pop() ?? "";
      return ENTITY_ID.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  private view(value: unknown) {
    if (value === undefined) return null;
    if (typeof value !== "string" || !VIEWS.has(value))
      throw new FreeAgentApiError(
        "freeagent_invoice_view_invalid",
        "FreeAgent invoice view is not allowlisted.",
      );
    return value;
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
    if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max)
      throw new FreeAgentApiError(
        "freeagent_input_invalid",
        `FreeAgent ${field} is outside the supported range.`,
      );
    return Number(value);
  }
}
