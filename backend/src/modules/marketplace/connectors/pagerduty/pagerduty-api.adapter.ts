export const PAGERDUTY_API_ORIGINS = new Set([
  "https://api.pagerduty.com",
  "https://api.eu.pagerduty.com",
]);

export type PagerDutyCredentials = { accessToken: string; apiOrigin: string };

export class PagerDutyApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class PagerDutyApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: PagerDutyCredentials) {
    const result = await this.listServices(credentials, { limit: 1 });
    return { ready: true, returnedCount: result.returnedCount };
  }

  async listIncidents(
    credentials: PagerDutyCredentials,
    input: { statuses?: unknown; limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      limit: String(limit),
      offset: "0",
    });
    for (const status of this.statuses(input.statuses))
      query.append("statuses[]", status);
    const body = this.record(
      await this.request(credentials, `/incidents?${query.toString()}`),
    );
    const incidents = this.array(body.incidents)
      .slice(0, limit)
      .map((value) => this.incident(value));
    return {
      incidents,
      returnedCount: incidents.length,
      more: body.more === true,
      automaticPagination: false,
    };
  }

  async getIncident(
    credentials: PagerDutyCredentials,
    input: { incidentId: unknown },
  ) {
    const incidentId = this.id(input.incidentId);
    const body = this.record(
      await this.request(credentials, `/incidents/${incidentId}`),
    );
    return { incident: this.incident(body.incident) };
  }

  async listServices(
    credentials: PagerDutyCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      limit: String(limit),
      offset: "0",
    });
    const body = this.record(
      await this.request(credentials, `/services?${query.toString()}`),
    );
    const services = this.array(body.services)
      .slice(0, limit)
      .map((value) => this.service(value));
    return {
      services,
      returnedCount: services.length,
      more: body.more === true,
      automaticPagination: false,
    };
  }

  private async request(credentials: PagerDutyCredentials, path: string) {
    const origin = this.origin(credentials.apiOrigin);
    const response = await this.requester(`${origin}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.pagerduty+json;version=2",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-PagerDuty/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "pagerduty_token_invalid"
          : response.status === 403
            ? "pagerduty_scope_denied"
            : response.status === 404
              ? "pagerduty_not_found"
              : response.status === 429
                ? "pagerduty_rate_limited"
                : "pagerduty_unavailable";
      throw new PagerDutyApiError(
        code,
        "PagerDuty API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new PagerDutyApiError(
        "pagerduty_response_too_large",
        "PagerDuty response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new PagerDutyApiError(
        "pagerduty_response_invalid",
        "PagerDuty returned an invalid response.",
      );
    }
  }

  private origin(value: string) {
    const normalized = value.replace(/\/$/, "");
    if (!PAGERDUTY_API_ORIGINS.has(normalized))
      throw new PagerDutyApiError(
        "pagerduty_region_invalid",
        "PagerDuty API region is not allowlisted.",
        400,
      );
    return normalized;
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new PagerDutyApiError(
        "pagerduty_limit_invalid",
        "PagerDuty result limit must be between 1 and 25.",
        400,
      );
    return Number(value);
  }

  private statuses(value: unknown) {
    if (value === undefined) return ["triggered", "acknowledged"];
    if (!Array.isArray(value) || value.length < 1 || value.length > 3)
      throw new PagerDutyApiError(
        "pagerduty_statuses_invalid",
        "PagerDuty statuses must contain one to three allowed values.",
        400,
      );
    const statuses = value.filter(
      (item): item is string => typeof item === "string",
    );
    if (
      statuses.length !== value.length ||
      statuses.some(
        (status) => !["triggered", "acknowledged", "resolved"].includes(status),
      )
    )
      throw new PagerDutyApiError(
        "pagerduty_statuses_invalid",
        "PagerDuty statuses must be triggered, acknowledged, or resolved.",
        400,
      );
    return Array.from(new Set(statuses));
  }

  private id(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value))
      throw new PagerDutyApiError(
        "pagerduty_incident_id_invalid",
        "PagerDuty incident ID is invalid.",
        400,
      );
    return value;
  }

  private incident(value: unknown) {
    const item = this.record(value);
    return {
      id: this.scalar(item.id),
      incidentNumber: this.scalar(item.incident_number),
      title: this.text(item.title ?? item.summary),
      status: this.text(item.status),
      urgency: this.text(item.urgency),
      createdAt: this.text(item.created_at),
      updatedAt: this.text(item.updated_at ?? item.last_status_change_at),
      service: this.reference(item.service),
      escalationPolicy: this.reference(item.escalation_policy),
      assignmentCount: this.array(item.assignments).length,
      alertCount: this.scalar(
        this.record(item.alert_counts).all ?? item.alerts_count,
      ),
    };
  }

  private service(value: unknown) {
    const item = this.record(value);
    return {
      id: this.scalar(item.id),
      name: this.text(item.name ?? item.summary),
      description: this.text(item.description),
      status: this.text(item.status),
      createdAt: this.text(item.created_at),
      escalationPolicy: this.reference(item.escalation_policy),
      teamCount: this.array(item.teams).length,
      integrationCount: this.array(item.integrations).length,
    };
  }

  private reference(value: unknown) {
    const item = this.record(value);
    return {
      id: this.scalar(item.id),
      name: this.text(item.summary ?? item.name),
      type: this.text(item.type),
    };
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_000) : null;
  }

  private scalar(value: unknown) {
    return typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
      ? value
      : null;
  }
}
