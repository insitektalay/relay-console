export type StatuspagePublicCredentials = { pageId: string };

export class StatuspagePublicApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class StatuspagePublicApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: StatuspagePublicCredentials) {
    const body = await this.get(credentials, "status");
    return {
      page: this.page(body.page),
      status: this.status(body.status),
    };
  }

  async readSummary(credentials: StatuspagePublicCredentials) {
    const body = await this.get(credentials, "summary");
    return {
      page: this.page(body.page),
      status: this.status(body.status),
      components: this.array(body.components)
        .slice(0, 25)
        .map((value) => this.component(value)),
      incidents: this.array(body.incidents)
        .slice(0, 25)
        .map((value) => this.incident(value)),
      scheduledMaintenances: this.array(body.scheduled_maintenances)
        .slice(0, 25)
        .map((value) => this.incident(value)),
    };
  }

  async listIncidents(
    credentials: StatuspagePublicCredentials,
    input: { filter?: unknown; limit?: unknown },
  ) {
    const filter = this.filter(input.filter, ["all", "unresolved", "resolved"]);
    const path = filter === "all" ? "incidents" : `incidents/${filter}`;
    const body = await this.get(credentials, path);
    const incidents = this.array(body.incidents)
      .slice(0, this.limit(input.limit))
      .map((value) => this.incident(value));
    return { filter, incidents, returnedCount: incidents.length };
  }

  async listScheduledMaintenances(
    credentials: StatuspagePublicCredentials,
    input: { filter?: unknown; limit?: unknown },
  ) {
    const filter = this.filter(input.filter, ["all", "upcoming", "active"]);
    const path =
      filter === "all"
        ? "scheduled-maintenances"
        : `scheduled-maintenances/${filter}`;
    const body = await this.get(credentials, path);
    const scheduledMaintenances = this.array(body.scheduled_maintenances)
      .slice(0, this.limit(input.limit))
      .map((value) => this.incident(value));
    return {
      filter,
      scheduledMaintenances,
      returnedCount: scheduledMaintenances.length,
    };
  }

  private async get(credentials: StatuspagePublicCredentials, path: string) {
    const pageId = this.pageId(credentials.pageId);
    if (!/^[a-z-]+(?:\/[a-z-]+)?$/.test(path))
      throw new StatuspagePublicApiError(
        "statuspage_path_invalid",
        "Statuspage public API path is invalid.",
        400,
      );
    const response = await this.requester(
      `https://${pageId}.statuspage.io/api/v2/${path}.json`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "RelayConsole-Statuspage/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const code =
        response.status === 404
          ? "statuspage_page_not_found"
          : response.status === 429
            ? "statuspage_rate_limited"
            : "statuspage_unavailable";
      throw new StatuspagePublicApiError(
        code,
        "Statuspage public status request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new StatuspagePublicApiError(
        "statuspage_response_too_large",
        "Statuspage response exceeded Relay's limit.",
      );
    try {
      return this.record(JSON.parse(text));
    } catch {
      throw new StatuspagePublicApiError(
        "statuspage_response_invalid",
        "Statuspage returned an invalid response.",
      );
    }
  }

  private pageId(value: unknown) {
    if (typeof value !== "string" || !/^[a-z0-9]{8,32}$/.test(value))
      throw new StatuspagePublicApiError(
        "statuspage_page_id_invalid",
        "Statuspage public page ID is invalid.",
        400,
      );
    return value;
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new StatuspagePublicApiError(
        "statuspage_limit_invalid",
        "Statuspage result limit must be between 1 and 25.",
        400,
      );
    return Number(value);
  }

  private filter<T extends string>(value: unknown, values: readonly T[]): T {
    const selected = value === undefined ? values[0] : value;
    if (typeof selected !== "string" || !values.includes(selected as T))
      throw new StatuspagePublicApiError(
        "statuspage_filter_invalid",
        "Statuspage filter is invalid.",
        400,
      );
    return selected as T;
  }

  private page(value: unknown) {
    const page = this.record(value);
    return {
      id: this.text(page.id),
      name: this.text(page.name),
      url: this.httpsUrl(page.url),
      updatedAt: this.text(page.updated_at),
    };
  }

  private status(value: unknown) {
    const status = this.record(value);
    return {
      indicator: this.text(status.indicator),
      description: this.text(status.description),
    };
  }

  private component(value: unknown) {
    const component = this.record(value);
    return {
      id: this.text(component.id),
      name: this.text(component.name),
      status: this.text(component.status),
      group: typeof component.group === "boolean" ? component.group : null,
      groupId: this.text(component.group_id),
      updatedAt: this.text(component.updated_at),
    };
  }

  private incident(value: unknown) {
    const incident = this.record(value);
    const updates = this.array(incident.incident_updates)
      .slice(0, 10)
      .map((item) => {
        const update = this.record(item);
        return {
          id: this.text(update.id),
          status: this.text(update.status),
          createdAt: this.text(update.created_at),
          updatedAt: this.text(update.updated_at),
        };
      });
    return {
      id: this.text(incident.id),
      name: this.text(incident.name),
      status: this.text(incident.status),
      impact: this.text(incident.impact),
      createdAt: this.text(incident.created_at),
      updatedAt: this.text(incident.updated_at),
      monitoringAt: this.text(incident.monitoring_at),
      resolvedAt: this.text(incident.resolved_at),
      scheduledFor: this.text(incident.scheduled_for),
      scheduledUntil: this.text(incident.scheduled_until),
      updates,
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

  private httpsUrl(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString().slice(0, 2_000) : null;
    } catch {
      return null;
    }
  }
}
