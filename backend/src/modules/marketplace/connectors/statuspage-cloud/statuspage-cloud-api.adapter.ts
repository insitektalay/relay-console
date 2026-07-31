import { Inject, Injectable, Optional } from "@nestjs/common";

export type StatuspageCloudCredentials = { apiToken: string; pageId: string };

export class StatuspageCloudApiError extends Error {
  constructor(
    readonly code:
      | "credential_missing"
      | "insufficient_scope"
      | "provider_rate_limited"
      | "provider_unavailable"
      | "provider_validation_error"
      | "policy_blocked",
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

type JsonObject = Record<string, unknown>;

@Injectable()
export class StatuspageCloudApiAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly origin = "https://api.statuspage.io";

  constructor(
    @Optional() @Inject("STATUSPAGE_CLOUD_FETCH") fetchImpl?: typeof fetch,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async health(credentials: StatuspageCloudCredentials) {
    await this.listComponents(credentials);
    return { ok: true };
  }

  async listComponents(credentials: StatuspageCloudCredentials) {
    const values = await this.request(
      credentials,
      "GET",
      `/v1/pages/${this.id(credentials.pageId, "page ID")}/components?page=1&per_page=25`,
    );
    return {
      components: (Array.isArray(values) ? values : [])
        .slice(0, 25)
        .map((item) => this.component(item)),
    };
  }

  async listIncidents(credentials: StatuspageCloudCredentials) {
    const values = await this.request(
      credentials,
      "GET",
      `/v1/pages/${this.id(credentials.pageId, "page ID")}/incidents?page=1&limit=25`,
    );
    return {
      incidents: (Array.isArray(values) ? values : [])
        .slice(0, 25)
        .map((item) => this.incident(item)),
    };
  }

  async updateComponentStatus(
    credentials: StatuspageCloudCredentials,
    input: JsonObject,
  ) {
    const componentId = this.id(input.componentId, "component ID");
    const status = this.status(input.status);
    const result = await this.request(
      credentials,
      "PATCH",
      `/v1/pages/${this.id(credentials.pageId, "page ID")}/components/${componentId}`,
      { component: { status } },
    );
    return { component: this.component(result) };
  }

  private async request(
    credentials: StatuspageCloudCredentials,
    method: "GET" | "PATCH",
    path: string,
    body?: JsonObject,
  ) {
    this.validateCredentials(credentials);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await this.fetchImpl(`${this.origin}${path}`, {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `OAuth ${credentials.apiToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 401)
        throw new StatuspageCloudApiError(
          "credential_missing",
          "Statuspage rejected the API token.",
          401,
        );
      if (response.status === 403)
        throw new StatuspageCloudApiError(
          "insufficient_scope",
          "Statuspage denied this operation.",
          403,
        );
      if (response.status === 404)
        throw new StatuspageCloudApiError(
          "provider_validation_error",
          "The bound page or requested component was not found.",
          404,
        );
      if (response.status === 420 || response.status === 429)
        throw new StatuspageCloudApiError(
          "provider_rate_limited",
          "Statuspage rate limit reached.",
          response.status,
        );
      if (!response.ok)
        throw new StatuspageCloudApiError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Statuspage returned HTTP ${response.status}.`,
          response.status,
        );
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > 1_000_000)
        throw new StatuspageCloudApiError(
          "provider_validation_error",
          "Statuspage response exceeds 1 MB.",
        );
      const text = await response.text();
      if (text.length > 1_000_000)
        throw new StatuspageCloudApiError(
          "provider_validation_error",
          "Statuspage response exceeds 1 MB.",
        );
      return text ? JSON.parse(text) : {};
    } catch (error) {
      if (error instanceof StatuspageCloudApiError) throw error;
      throw new StatuspageCloudApiError(
        "provider_unavailable",
        "Statuspage could not be reached.",
        502,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private component(value: unknown) {
    const item = this.object(value);
    return {
      id: this.string(item.id)?.slice(0, 100) ?? null,
      name: this.string(item.name)?.slice(0, 300) ?? null,
      status: this.string(item.status)?.slice(0, 50) ?? null,
      group: item.group === true,
      groupId: this.string(item.group_id)?.slice(0, 100) ?? null,
      onlyShowIfDegraded: item.only_show_if_degraded === true,
      updatedAt: this.string(item.updated_at)?.slice(0, 50) ?? null,
    };
  }

  private incident(value: unknown) {
    const item = this.object(value);
    return {
      id: this.string(item.id)?.slice(0, 100) ?? null,
      name: this.string(item.name)?.slice(0, 500) ?? null,
      status: this.string(item.status)?.slice(0, 50) ?? null,
      impact: this.string(item.impact)?.slice(0, 50) ?? null,
      createdAt: this.string(item.created_at)?.slice(0, 50) ?? null,
      updatedAt: this.string(item.updated_at)?.slice(0, 50) ?? null,
      resolvedAt: this.string(item.resolved_at)?.slice(0, 50) ?? null,
    };
  }

  private validateCredentials(credentials: StatuspageCloudCredentials) {
    if (!credentials.apiToken?.trim())
      throw new StatuspageCloudApiError(
        "credential_missing",
        "Statuspage API token is required.",
        401,
      );
    this.id(credentials.pageId, "page ID");
  }

  private id(value: unknown, label: string) {
    const id = this.string(value)?.trim();
    if (!id || !/^[A-Za-z0-9]{1,100}$/.test(id))
      throw new StatuspageCloudApiError(
        "provider_validation_error",
        `Statuspage ${label} is invalid.`,
      );
    return id;
  }

  private status(value: unknown) {
    const allowed = [
      "operational",
      "degraded_performance",
      "partial_outage",
      "major_outage",
      "under_maintenance",
    ];
    if (typeof value !== "string" || !allowed.includes(value))
      throw new StatuspageCloudApiError(
        "provider_validation_error",
        "Component status is invalid.",
      );
    return value;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private string(value: unknown) {
    return typeof value === "string" ? value : undefined;
  }
}
