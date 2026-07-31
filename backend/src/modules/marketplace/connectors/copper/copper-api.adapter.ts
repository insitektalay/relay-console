import { Injectable } from "@nestjs/common";

export type CopperApiCredentials = { accessToken: string; accountId: string };

export class CopperApiError extends Error {
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
const ID = /^[1-9][0-9]{0,19}$/;
const API_ORIGIN = "https://api.copper.com";

@Injectable()
export class CopperApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: CopperApiCredentials) {
    const account = await this.getAccount(credentials);
    if (String(account.account.accountId) !== credentials.accountId)
      throw new CopperApiError(
        "copper_account_binding_mismatch",
        "Copper account binding changed.",
      );
    return {
      accountId: credentials.accountId,
      apiVersion: "developer_api/v1",
      reachable: true,
    };
  }

  async getAccount(credentials: CopperApiCredentials) {
    const body = await this.send(
      credentials,
      "GET",
      "/developer_api/v1/account",
    );
    return { account: this.account(this.object(body)) };
  }

  async listOpportunities(
    credentials: CopperApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const body = await this.send(
      credentials,
      "POST",
      "/developer_api/v1/opportunities/search",
      {
        page_size: limit,
        sort_by: "date_modified",
        sort_direction: "desc",
      },
    );
    return {
      accountId: credentials.accountId,
      opportunities: this.rows(body)
        .slice(0, limit)
        .map((row) => this.opportunity(row)),
    };
  }

  async getOpportunity(
    credentials: CopperApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (
      typeof input.opportunityId !== "string" ||
      !ID.test(input.opportunityId)
    )
      throw new CopperApiError(
        "copper_opportunity_id_invalid",
        "A positive numeric Copper Opportunity ID is required.",
      );
    const body = await this.send(
      credentials,
      "GET",
      `/developer_api/v1/opportunities/${input.opportunityId}`,
    );
    return {
      accountId: credentials.accountId,
      opportunity: this.opportunity(this.object(body)),
    };
  }

  private async send(
    credentials: CopperApiCredentials,
    method: "GET" | "POST",
    path: string,
    json?: Record<string, unknown>,
  ) {
    if (!ID.test(credentials.accountId))
      throw new CopperApiError(
        "copper_account_binding_invalid",
        "Copper connection is not bound to a valid account ID.",
      );
    if (!credentials.accessToken.trim())
      throw new CopperApiError(
        "copper_token_invalid",
        "Copper connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          ...(json ? { "Content-Type": "application/json" } : {}),
        },
        ...(json ? { body: JSON.stringify(json) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new CopperApiError(
        "copper_unavailable",
        "Copper is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new CopperApiError(
        "copper_response_too_large",
        "Copper response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new CopperApiError(
        "copper_response_invalid",
        "Copper returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new CopperApiError(
        response.status === 401
          ? "copper_token_invalid"
          : response.status === 403
            ? "copper_permission_denied"
            : response.status === 429
              ? "copper_rate_limited"
              : "copper_http_error",
        "Copper API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private rows(value: unknown) {
    return Array.isArray(value) ? value.map((item) => this.object(item)) : [];
  }
  private account(row: Record<string, unknown>) {
    return {
      accountId: this.scalar(row.id),
      name: this.scalar(row.name),
      primaryTimezone: this.scalar(row.primary_timezone),
    };
  }
  private opportunity(row: Record<string, unknown>) {
    return {
      opportunityId: this.scalar(row.id),
      name: this.scalar(row.name),
      companyId: this.scalar(row.company_id),
      companyName: this.scalar(row.company_name),
      closeDate: this.scalar(row.close_date),
      monetaryValue: this.scalar(row.monetary_value),
      monetaryUnit: this.scalar(row.monetary_unit),
      status: this.scalar(row.status),
      priority: this.scalar(row.priority),
      pipelineId: this.scalar(row.pipeline_id),
      pipelineStageId: this.scalar(row.pipeline_stage_id),
      winProbability: this.scalar(row.win_probability),
      createdAt: this.scalar(row.date_created),
      modifiedAt: this.scalar(row.date_modified),
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
      throw new CopperApiError(
        "copper_input_invalid",
        "Copper result limit is outside the supported range.",
      );
    return Number(value);
  }
}
