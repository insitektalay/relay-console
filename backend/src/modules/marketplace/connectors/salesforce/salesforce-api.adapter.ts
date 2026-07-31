export type SalesforceApiCredentials = {
  accessToken: string;
  organizationId: string;
  instanceOrigin: string;
};

export class SalesforceApiError extends Error {
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
const ORGANIZATION_ID = /^00D[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/;
const OPPORTUNITY_ID = /^006[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/;
const API_VERSION = "v67.0";

export class SalesforceApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: SalesforceApiCredentials) {
    const result = await this.query(
      credentials,
      `SELECT Id, Name FROM Organization WHERE Id = '${credentials.organizationId}' LIMIT 1`,
    );
    const organization = this.object(result.records?.[0]);
    if (organization.Id !== credentials.organizationId)
      throw new SalesforceApiError(
        "salesforce_organization_binding_mismatch",
        "Salesforce token is not valid for the connected organization.",
      );
    return {
      organization: {
        organizationId: this.scalar(organization.Id),
        name: this.scalar(organization.Name),
      },
      apiVersion: API_VERSION,
    };
  }

  async listAccounts(
    credentials: SalesforceApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const result = await this.query(
      credentials,
      `SELECT Id, Name, Industry, Type FROM Account ORDER BY LastModifiedDate DESC LIMIT ${limit}`,
    );
    return {
      organizationId: credentials.organizationId,
      accounts: (result.records ?? []).slice(0, limit).map((value) => {
        const row = this.object(value);
        return {
          accountId: this.scalar(row.Id),
          name: this.scalar(row.Name),
          industry: this.scalar(row.Industry),
          type: this.scalar(row.Type),
        };
      }),
    };
  }

  async listOpportunities(
    credentials: SalesforceApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    return {
      organizationId: credentials.organizationId,
      opportunities: await this.opportunities(
        credentials,
        `ORDER BY LastModifiedDate DESC LIMIT ${limit}`,
        limit,
      ),
    };
  }

  async getOpportunity(
    credentials: SalesforceApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (
      typeof input.opportunityId !== "string" ||
      !OPPORTUNITY_ID.test(input.opportunityId)
    )
      throw new SalesforceApiError(
        "salesforce_opportunity_id_invalid",
        "A valid Salesforce Opportunity ID is required.",
      );
    const rows = await this.opportunities(
      credentials,
      `WHERE Id = '${input.opportunityId}' LIMIT 1`,
      1,
    );
    return {
      organizationId: credentials.organizationId,
      opportunity: rows[0] ?? null,
    };
  }

  private async opportunities(
    credentials: SalesforceApiCredentials,
    suffix: string,
    limit: number,
  ) {
    const result = await this.query(
      credentials,
      `SELECT Id, Name, StageName, Amount, CloseDate, Probability, IsClosed, IsWon FROM Opportunity ${suffix}`,
    );
    return (result.records ?? []).slice(0, limit).map((value) => {
      const row = this.object(value);
      return {
        opportunityId: this.scalar(row.Id),
        name: this.scalar(row.Name),
        stage: this.scalar(row.StageName),
        amount: this.scalar(row.Amount),
        closeDate: this.scalar(row.CloseDate),
        probability: this.scalar(row.Probability),
        isClosed: this.scalar(row.IsClosed),
        isWon: this.scalar(row.IsWon),
      };
    });
  }

  private async query(credentials: SalesforceApiCredentials, soql: string) {
    if (!ORGANIZATION_ID.test(credentials.organizationId))
      throw new SalesforceApiError(
        "salesforce_organization_binding_invalid",
        "Salesforce connection is not bound to a valid organization.",
      );
    if (!credentials.accessToken.trim())
      throw new SalesforceApiError(
        "salesforce_token_invalid",
        "Salesforce connection token is missing.",
      );
    const origin = this.instanceOrigin(credentials.instanceOrigin);
    const url = new URL(`/services/data/${API_VERSION}/query`, origin);
    url.searchParams.set("q", soql);
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
      throw new SalesforceApiError(
        "salesforce_unavailable",
        "Salesforce is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new SalesforceApiError(
        "salesforce_response_too_large",
        "Salesforce response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new SalesforceApiError(
        "salesforce_response_invalid",
        "Salesforce returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new SalesforceApiError(
        response.status === 401
          ? "salesforce_token_invalid"
          : response.status === 403
            ? "salesforce_permission_denied"
            : response.status === 429
              ? "salesforce_rate_limited"
              : "salesforce_http_error",
        "Salesforce API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return {
      ...body,
      records: Array.isArray(body.records) ? body.records : [],
    } as Record<string, unknown> & { records: unknown[] };
  }

  private instanceOrigin(value: string) {
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        !url.hostname.toLowerCase().endsWith(".my.salesforce.com") ||
        url.username ||
        url.password ||
        url.port ||
        (url.pathname !== "/" && url.pathname !== "") ||
        url.search ||
        url.hash
      )
        throw new Error();
      return url.origin;
    } catch {
      throw new SalesforceApiError(
        "salesforce_instance_binding_invalid",
        "Salesforce connection is not bound to a valid instance.",
      );
    }
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
      throw new SalesforceApiError(
        "salesforce_input_invalid",
        "Salesforce result limit is outside the supported range.",
      );
    return Number(value);
  }
}
