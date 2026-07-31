import { Injectable } from "@nestjs/common";

export type CloseApiCredentials = {
  accessToken: string;
  organizationId: string;
};
export class CloseApiError extends Error {
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
const CLOSE_ID = /^(?:orga|oppo)_[A-Za-z0-9]{1,200}$/;
const ORG_ID = /^orga_[A-Za-z0-9]{1,200}$/;
const OPPORTUNITY_ID = /^oppo_[A-Za-z0-9]{1,200}$/;
const API_ORIGIN = "https://api.close.com";
const OPPORTUNITY_FIELDS =
  "id,organization_id,status_id,status_label,status_type,value,value_period,value_currency,confidence,pipeline_id,pipeline_name,date_created,date_updated,date_won,date_lost";

@Injectable()
export class CloseApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: CloseApiCredentials) {
    const me = this.object(
      await this.send(credentials, "/api/v1/me/?_fields=id,organizations"),
    );
    const organizations = Array.isArray(me.organizations)
      ? me.organizations.map((row) => this.object(row))
      : [];
    if (!organizations.some((row) => row.id === credentials.organizationId))
      throw new CloseApiError(
        "close_organization_binding_mismatch",
        "Close organization binding changed.",
      );
    return {
      organizationId: credentials.organizationId,
      apiVersion: "v1",
      reachable: true,
    };
  }

  async getOrganization(credentials: CloseApiCredentials) {
    const body = await this.send(
      credentials,
      `/api/v1/organization/${credentials.organizationId}/?_fields=id,name,date_created,date_updated,plan_type`,
    );
    const organization = this.organization(this.object(body));
    if (organization.organizationId !== credentials.organizationId)
      throw new CloseApiError(
        "close_organization_binding_mismatch",
        "Close organization binding changed.",
      );
    return { organization };
  }

  async listOpportunities(
    credentials: CloseApiCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const body = this.object(
      await this.send(
        credentials,
        `/api/v1/opportunity/?_limit=${limit}&_skip=0&_order_by=-date_updated&_fields=${encodeURIComponent(OPPORTUNITY_FIELDS)}`,
      ),
    );
    const rows = Array.isArray(body.data)
      ? body.data.map((row) => this.object(row))
      : [];
    const opportunities = rows
      .slice(0, limit)
      .map((row) => this.opportunity(row));
    if (
      opportunities.some(
        (row) => row.organizationId !== credentials.organizationId,
      )
    )
      throw new CloseApiError(
        "close_organization_binding_mismatch",
        "Close returned an Opportunity outside the connected organization.",
      );
    return { organizationId: credentials.organizationId, opportunities };
  }

  async getOpportunity(
    credentials: CloseApiCredentials,
    input: Record<string, unknown>,
  ) {
    if (
      typeof input.opportunityId !== "string" ||
      !OPPORTUNITY_ID.test(input.opportunityId)
    )
      throw new CloseApiError(
        "close_opportunity_id_invalid",
        "A valid Close oppo_ Opportunity ID is required.",
      );
    const body = await this.send(
      credentials,
      `/api/v1/opportunity/${input.opportunityId}/?_fields=${encodeURIComponent(OPPORTUNITY_FIELDS)}`,
    );
    const opportunity = this.opportunity(this.object(body));
    if (opportunity.organizationId !== credentials.organizationId)
      throw new CloseApiError(
        "close_organization_binding_mismatch",
        "Close Opportunity is outside the connected organization.",
      );
    return { organizationId: credentials.organizationId, opportunity };
  }

  private async send(credentials: CloseApiCredentials, path: string) {
    if (!ORG_ID.test(credentials.organizationId))
      throw new CloseApiError(
        "close_organization_binding_invalid",
        "Close connection is not bound to a valid organization ID.",
      );
    if (!credentials.accessToken.trim())
      throw new CloseApiError(
        "close_token_invalid",
        "Close connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
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
      throw new CloseApiError(
        "close_unavailable",
        "Close is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new CloseApiError(
        "close_response_too_large",
        "Close response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new CloseApiError(
        "close_response_invalid",
        "Close returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new CloseApiError(
        response.status === 401
          ? "close_token_invalid"
          : response.status === 403
            ? "close_permission_denied"
            : response.status === 404
              ? "close_record_not_found"
              : response.status === 429
                ? "close_rate_limited"
                : "close_http_error",
        "Close API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private organization(row: Record<string, unknown>) {
    return {
      organizationId: this.id(row.id, "orga_"),
      name: this.scalar(row.name),
      planType: this.scalar(row.plan_type),
      createdAt: this.scalar(row.date_created),
      updatedAt: this.scalar(row.date_updated),
    };
  }
  private opportunity(row: Record<string, unknown>) {
    return {
      opportunityId: this.id(row.id, "oppo_"),
      organizationId: this.id(row.organization_id, "orga_"),
      statusId: this.scalar(row.status_id),
      statusLabel: this.scalar(row.status_label),
      statusType: this.scalar(row.status_type),
      value: this.scalar(row.value),
      valuePeriod: this.scalar(row.value_period),
      valueCurrency: this.scalar(row.value_currency),
      confidence: this.scalar(row.confidence),
      pipelineId: this.scalar(row.pipeline_id),
      pipelineName: this.scalar(row.pipeline_name),
      createdAt: this.scalar(row.date_created),
      updatedAt: this.scalar(row.date_updated),
      wonAt: this.scalar(row.date_won),
      lostAt: this.scalar(row.date_lost),
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
  private id(value: unknown, prefix: "orga_" | "oppo_") {
    if (
      typeof value !== "string" ||
      !value.startsWith(prefix) ||
      !CLOSE_ID.test(value)
    )
      throw new CloseApiError(
        "close_response_invalid",
        "Close returned an invalid bound identifier.",
      );
    return value;
  }
  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new CloseApiError(
        "close_input_invalid",
        "Close result limit is outside the supported range.",
      );
    return Number(value);
  }
}
