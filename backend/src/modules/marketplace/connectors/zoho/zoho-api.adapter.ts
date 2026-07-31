export type ZohoApiCredentials = {
  accessToken: string;
  organizationId: string;
  apiOrigin: string;
};

export class ZohoApiError extends Error {
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
const ID = /^[1-9][0-9]{0,24}$/;
const API_ORIGINS = new Set([
  "https://www.zohoapis.com",
  "https://www.zohoapis.eu",
  "https://www.zohoapis.in",
  "https://www.zohoapis.com.au",
  "https://www.zohoapis.jp",
  "https://www.zohoapis.ca",
  "https://www.zohoapis.com.cn",
  "https://www.zohoapis.ae",
  "https://www.zohoapis.sa",
  "https://www.zohoapis.uk",
]);
const ACCOUNT_FIELDS = [
  "id",
  "Account_Name",
  "Account_Number",
  "Account_Type",
  "Industry",
  "Annual_Revenue",
  "Employees",
  "Created_Time",
  "Modified_Time",
];
const DEAL_FIELDS = [
  "id",
  "Deal_Name",
  "Amount",
  "Closing_Date",
  "Stage",
  "Pipeline",
  "Type",
  "Probability",
  "Expected_Revenue",
  "Account_Name",
  "Created_Time",
  "Modified_Time",
];

export class ZohoApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ZohoApiCredentials) {
    const result = await this.listAccounts(credentials, { limit: 1 });
    return {
      organizationId: credentials.organizationId,
      apiVersion: "v8",
      reachable: Array.isArray(result.accounts),
    };
  }

  async listAccounts(
    credentials: ZohoApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, "/crm/v8/Accounts", {
      fields: ACCOUNT_FIELDS.join(","),
      page: 1,
      per_page: limit,
      sort_by: "Modified_Time",
      sort_order: "desc",
    });
    return {
      organizationId: credentials.organizationId,
      accounts: this.rows(body)
        .slice(0, limit)
        .map((row) => ({
          accountId: this.scalar(row.id),
          name: this.scalar(row.Account_Name),
          accountNumber: this.scalar(row.Account_Number),
          type: this.scalar(row.Account_Type),
          industry: this.scalar(row.Industry),
          annualRevenue: this.scalar(row.Annual_Revenue),
          employees: this.scalar(row.Employees),
          createdAt: this.scalar(row.Created_Time),
          modifiedAt: this.scalar(row.Modified_Time),
        })),
    };
  }

  async listDeals(
    credentials: ZohoApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, "/crm/v8/Deals", {
      fields: DEAL_FIELDS.join(","),
      page: 1,
      per_page: limit,
      sort_by: "Modified_Time",
      sort_order: "desc",
    });
    return {
      organizationId: credentials.organizationId,
      deals: this.rows(body)
        .slice(0, limit)
        .map((row) => this.deal(row)),
    };
  }

  async getDeal(
    credentials: ZohoApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (typeof input.dealId !== "string" || !ID.test(input.dealId))
      throw new ZohoApiError(
        "zoho_deal_id_invalid",
        "A positive numeric Zoho CRM Deal ID is required.",
      );
    const body = await this.send(credentials, `/crm/v8/Deals/${input.dealId}`, {
      fields: DEAL_FIELDS.join(","),
    });
    const row = this.rows(body)[0];
    if (!row)
      throw new ZohoApiError(
        "zoho_deal_not_found",
        "Zoho CRM did not return that Deal.",
        404,
      );
    return { organizationId: credentials.organizationId, deal: this.deal(row) };
  }

  private async send(
    credentials: ZohoApiCredentials,
    path: string,
    query: Record<string, string | number>,
  ) {
    if (!ID.test(credentials.organizationId))
      throw new ZohoApiError(
        "zoho_organization_binding_invalid",
        "Zoho CRM connection is not bound to a valid organization ID.",
      );
    if (!credentials.accessToken.trim())
      throw new ZohoApiError(
        "zoho_token_invalid",
        "Zoho CRM connection token is missing.",
      );
    const origin = this.origin(credentials.apiOrigin);
    const url = new URL(path, origin);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Zoho-oauthtoken ${credentials.accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ZohoApiError(
        "zoho_unavailable",
        "Zoho CRM is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new ZohoApiError(
        "zoho_response_too_large",
        "Zoho CRM response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new ZohoApiError(
        "zoho_response_invalid",
        "Zoho CRM returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new ZohoApiError(
        response.status === 401
          ? "zoho_token_invalid"
          : response.status === 403
            ? "zoho_permission_denied"
            : response.status === 429
              ? "zoho_rate_limited"
              : "zoho_http_error",
        "Zoho CRM API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private origin(value: string) {
    try {
      const url = new URL(value);
      if (url.origin !== value || !API_ORIGINS.has(url.origin))
        throw new Error();
      return url.origin;
    } catch {
      throw new ZohoApiError(
        "zoho_api_origin_invalid",
        "Zoho CRM regional API binding is invalid.",
      );
    }
  }
  private rows(body: Record<string, unknown>) {
    return Array.isArray(body.data)
      ? body.data.map((value) => this.object(value))
      : [];
  }
  private deal(row: Record<string, unknown>) {
    const account = this.object(row.Account_Name);
    return {
      dealId: this.scalar(row.id),
      name: this.scalar(row.Deal_Name),
      amount: this.scalar(row.Amount),
      closingDate: this.scalar(row.Closing_Date),
      stage: this.scalar(row.Stage),
      pipeline: this.scalar(row.Pipeline),
      type: this.scalar(row.Type),
      probability: this.scalar(row.Probability),
      expectedRevenue: this.scalar(row.Expected_Revenue),
      accountId: this.scalar(account.id),
      accountName: this.scalar(account.name),
      createdAt: this.scalar(row.Created_Time),
      modifiedAt: this.scalar(row.Modified_Time),
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
  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new ZohoApiError(
        "zoho_input_invalid",
        "Zoho CRM result limit is outside the supported range.",
      );
    return Number(value);
  }
}
