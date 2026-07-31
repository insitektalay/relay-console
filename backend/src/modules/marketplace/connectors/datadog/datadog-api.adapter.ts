export const DATADOG_API_ORIGINS = new Set([
  "https://api.datadoghq.com",
  "https://api.us3.datadoghq.com",
  "https://api.us5.datadoghq.com",
  "https://api.datadoghq.eu",
  "https://api.ap1.datadoghq.com",
  "https://api.ap2.datadoghq.com",
  "https://api.uk1.datadoghq.com",
  "https://api.ddog-gov.com",
  "https://api.us2.ddog-gov.com",
]);

export type DatadogCredentials = { accessToken: string; apiOrigin: string };

export class DatadogApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class DatadogApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: DatadogCredentials) {
    const result = await this.searchMonitors(credentials, { limit: 1 });
    return { ready: true, returnedCount: result.returnedCount };
  }

  async searchMonitors(
    credentials: DatadogCredentials,
    input: { query?: unknown; limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({ page: "0", per_page: String(limit) });
    const search = this.optionalText(input.query, 500);
    if (search) query.set("query", search);
    const body = await this.request(
      credentials,
      `/api/v1/monitor/search?${query.toString()}`,
    );
    const values = this.array(this.record(body).monitors)
      .slice(0, limit)
      .map((value) => {
        const item = this.record(value);
        return {
          id: this.scalar(item.id),
          name: this.text(item.name),
          status: this.text(item.status ?? item.overall_state),
          type: this.text(item.type),
          tags: this.textArray(item.tags),
          scopes: this.textArray(item.scopes),
          lastTriggeredAt: this.scalar(item.last_triggered_ts),
          priority: this.scalar(item.priority),
        };
      });
    return { monitors: values, returnedCount: values.length };
  }

  async searchIncidents(
    credentials: DatadogCredentials,
    input: { query?: unknown; limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      query:
        this.optionalText(input.query, 500) ??
        "state:(active OR stable OR resolved)",
      "page[size]": String(limit),
      sort: "-created",
    });
    const body = await this.request(
      credentials,
      `/api/v2/incidents/search?${query.toString()}`,
    );
    const root = this.record(body);
    const container = this.record(root.data);
    const raw = Array.isArray(root.data) ? root.data : container.data;
    const values = this.array(raw)
      .slice(0, limit)
      .map((value) => {
        const item = this.record(value);
        const attributes = this.record(item.attributes);
        return {
          id: this.scalar(item.id),
          title: this.text(attributes.title),
          status: this.text(attributes.state ?? attributes.status),
          severity: this.text(attributes.severity),
          createdAt: this.text(attributes.created ?? attributes.created_at),
          modifiedAt: this.text(attributes.modified ?? attributes.modified_at),
          commander: this.text(this.record(attributes.commander).name),
          services: this.textArray(attributes.services),
        };
      });
    return { incidents: values, returnedCount: values.length };
  }

  async listServices(
    credentials: DatadogCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({ "page[size]": String(limit) });
    const body = await this.request(
      credentials,
      `/api/v2/services/definitions?${query.toString()}`,
    );
    const root = this.record(body);
    const values = this.array(root.data ?? body)
      .slice(0, limit)
      .map((value) => {
        const item = this.record(value);
        const attributes = this.record(item.attributes);
        const schema = this.record(attributes.schema);
        return {
          id: this.scalar(item.id),
          name: this.text(schema["dd-service"] ?? schema.name),
          schemaVersion: this.text(
            attributes["schema-version"] ?? attributes.schema_version,
          ),
          description: this.text(schema.description),
          lifecycle: this.text(schema.lifecycle),
          owner: this.text(schema.team ?? schema.owner),
          contacts: this.safeArray(schema.contacts),
          links: this.safeArray(schema.links),
          tags: this.safeArray(schema.tags),
        };
      });
    return { services: values, returnedCount: values.length };
  }

  private async request(credentials: DatadogCredentials, path: string) {
    const origin = this.origin(credentials.apiOrigin);
    const response = await this.requester(`${origin}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Datadog/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "datadog_token_invalid"
          : response.status === 403
            ? "datadog_scope_denied"
            : response.status === 429
              ? "datadog_rate_limited"
              : "datadog_unavailable";
      throw new DatadogApiError(
        code,
        "Datadog API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new DatadogApiError(
        "datadog_response_too_large",
        "Datadog response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new DatadogApiError(
        "datadog_response_invalid",
        "Datadog returned an invalid response.",
      );
    }
  }

  private origin(value: string) {
    const normalized = value.replace(/\/$/, "");
    if (!DATADOG_API_ORIGINS.has(normalized))
      throw new DatadogApiError(
        "datadog_site_invalid",
        "Datadog API site is not allowlisted.",
        400,
      );
    return normalized;
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new DatadogApiError(
        "datadog_limit_invalid",
        "Datadog result limit must be between 1 and 25.",
        400,
      );
    return Number(value);
  }

  private optionalText(value: unknown, maxLength: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || value.length > maxLength)
      throw new DatadogApiError(
        "datadog_query_invalid",
        "Datadog search query is invalid.",
        400,
      );
    return value;
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

  private textArray(value: unknown) {
    return this.array(value)
      .slice(0, 25)
      .flatMap((item) =>
        typeof item === "string" ? [item.slice(0, 500)] : [],
      );
  }

  private safeArray(value: unknown) {
    return this.array(value)
      .slice(0, 25)
      .map((item) => {
        if (typeof item === "string") return item.slice(0, 500);
        const record = this.record(item);
        return Object.fromEntries(
          Object.entries(record)
            .slice(0, 8)
            .map(([key, field]) => [key, this.scalar(field)]),
        );
      });
  }
}
