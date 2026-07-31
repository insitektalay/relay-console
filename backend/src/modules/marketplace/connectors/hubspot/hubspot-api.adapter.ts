export type HubSpotApiCredentials = {
  accessToken: string;
  hubId: string;
};

export class HubSpotApiError extends Error {
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
const HUB_ID = /^[1-9][0-9]{0,19}$/;
const DEAL_ID = /^[1-9][0-9]{0,19}$/;
const API_VERSION = "2026-03";
const COMPANY_PROPERTIES = [
  "name",
  "domain",
  "industry",
  "country",
  "createdate",
  "hs_lastmodifieddate",
];
const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "closedate",
  "pipeline",
  "dealstage",
  "createdate",
  "hs_lastmodifieddate",
];

export class HubSpotApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: HubSpotApiCredentials) {
    const result = await this.search(
      credentials,
      "companies",
      COMPANY_PROPERTIES,
      1,
    );
    return {
      hubId: credentials.hubId,
      apiVersion: API_VERSION,
      reachable: Array.isArray(result.results),
    };
  }

  async listCompanies(
    credentials: HubSpotApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const result = await this.search(
      credentials,
      "companies",
      COMPANY_PROPERTIES,
      limit,
    );
    return {
      hubId: credentials.hubId,
      companies: result.results.slice(0, limit).map((value) => {
        const row = this.object(value);
        const properties = this.object(row.properties);
        return {
          companyId: this.scalar(row.id),
          name: this.scalar(properties.name),
          domain: this.scalar(properties.domain),
          industry: this.scalar(properties.industry),
          country: this.scalar(properties.country),
          createdAt: this.scalar(properties.createdate),
          lastModifiedAt: this.scalar(properties.hs_lastmodifieddate),
        };
      }),
    };
  }

  async listDeals(
    credentials: HubSpotApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const result = await this.search(
      credentials,
      "deals",
      DEAL_PROPERTIES,
      limit,
    );
    return {
      hubId: credentials.hubId,
      deals: result.results.slice(0, limit).map((value) => this.deal(value)),
    };
  }

  async getDeal(
    credentials: HubSpotApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (typeof input.dealId !== "string" || !DEAL_ID.test(input.dealId))
      throw new HubSpotApiError(
        "hubspot_deal_id_invalid",
        "A positive numeric HubSpot Deal ID is required.",
      );
    const url = new URL(
      `https://api.hubapi.com/crm/objects/${API_VERSION}/deals/${input.dealId}`,
    );
    url.searchParams.set("properties", DEAL_PROPERTIES.join(","));
    url.searchParams.set("archived", "false");
    const row = await this.send(credentials, url.toString(), { method: "GET" });
    return { hubId: credentials.hubId, deal: this.deal(row) };
  }

  private async search(
    credentials: HubSpotApiCredentials,
    object: "companies" | "deals",
    properties: string[],
    limit: number,
  ) {
    const body = await this.send(
      credentials,
      `https://api.hubapi.com/crm/objects/${API_VERSION}/${object}/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [],
          limit,
          properties,
          sorts: ["-hs_lastmodifieddate"],
        }),
      },
    );
    return {
      ...body,
      results: Array.isArray(body.results) ? body.results : [],
    };
  }

  private async send(
    credentials: HubSpotApiCredentials,
    url: string,
    init: RequestInit,
  ) {
    if (!HUB_ID.test(credentials.hubId))
      throw new HubSpotApiError(
        "hubspot_hub_binding_invalid",
        "HubSpot connection is not bound to a valid Hub ID.",
      );
    if (!credentials.accessToken.trim())
      throw new HubSpotApiError(
        "hubspot_token_invalid",
        "HubSpot connection token is missing.",
      );
    let response: Response;
    try {
      response = await this.request(url, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          ...(init.headers ?? {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new HubSpotApiError(
        "hubspot_unavailable",
        "HubSpot is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new HubSpotApiError(
        "hubspot_response_too_large",
        "HubSpot response exceeded the safe size limit.",
      );
    let body: Record<string, unknown> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed;
    } catch {
      throw new HubSpotApiError(
        "hubspot_response_invalid",
        "HubSpot returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new HubSpotApiError(
        response.status === 401
          ? "hubspot_token_invalid"
          : response.status === 403
            ? "hubspot_permission_denied"
            : response.status === 429
              ? "hubspot_rate_limited"
              : "hubspot_http_error",
        "HubSpot API request failed.",
        response.status,
        {
          category: this.scalar(body.category),
          correlationId: this.scalar(body.correlationId),
          retryAfter: response.headers.get("retry-after"),
        },
      );
    return body;
  }

  private deal(value: unknown) {
    const row = this.object(value);
    const properties = this.object(row.properties);
    return {
      dealId: this.scalar(row.id),
      name: this.scalar(properties.dealname),
      amount: this.scalar(properties.amount),
      closeDate: this.scalar(properties.closedate),
      pipelineId: this.scalar(properties.pipeline),
      stageId: this.scalar(properties.dealstage),
      createdAt: this.scalar(properties.createdate),
      lastModifiedAt: this.scalar(properties.hs_lastmodifieddate),
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
      throw new HubSpotApiError(
        "hubspot_input_invalid",
        "HubSpot result limit is outside the supported range.",
      );
    return Number(value);
  }
}
