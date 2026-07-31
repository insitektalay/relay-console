import { Inject, Injectable, Optional } from "@nestjs/common";

export type OpsgenieCloudCredentials = { apiKey: string; region: "US" | "EU" };

export class OpsgenieCloudApiError extends Error {
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
export class OpsgenieCloudApiAdapter {
  private readonly fetchImpl: typeof fetch;

  constructor(
    @Optional() @Inject("OPSGENIE_CLOUD_FETCH") fetchImpl?: typeof fetch,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async health(credentials: OpsgenieCloudCredentials) {
    await this.listAlerts(credentials, { limit: 1 });
    return { ok: true };
  }

  async listAlerts(credentials: OpsgenieCloudCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const status = this.optionalStatus(input.status);
    const query = new URLSearchParams({
      limit: String(limit),
      sort: "createdAt",
      order: "desc",
    });
    if (status) query.set("query", `status:${status}`);
    const payload = this.object(
      await this.request(credentials, `/v2/alerts?${query}`),
    );
    const data = Array.isArray(payload.data) ? payload.data : [];
    return {
      alerts: data.slice(0, limit).map((item) => this.summary(item)),
      count: Math.min(data.length, limit),
    };
  }

  async getAlert(credentials: OpsgenieCloudCredentials, input: JsonObject) {
    const alertId = this.requiredId(input.alertId);
    const payload = this.object(
      await this.request(
        credentials,
        `/v2/alerts/${encodeURIComponent(alertId)}?identifierType=id`,
      ),
    );
    return { alert: this.summary(payload.data) };
  }

  private async request(credentials: OpsgenieCloudCredentials, path: string) {
    this.validateCredentials(credentials);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await this.fetchImpl(
        `${this.origin(credentials.region)}${path}`,
        {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            Authorization: `GenieKey ${credentials.apiKey}`,
          },
        },
      );
      if (response.status === 401)
        throw new OpsgenieCloudApiError(
          "credential_missing",
          "Opsgenie rejected the API key.",
          401,
        );
      if (response.status === 403)
        throw new OpsgenieCloudApiError(
          "insufficient_scope",
          "Opsgenie denied this alert read.",
          403,
        );
      if (response.status === 404)
        throw new OpsgenieCloudApiError(
          "provider_validation_error",
          "The requested Opsgenie alert was not found.",
          404,
        );
      if (response.status === 429)
        throw new OpsgenieCloudApiError(
          "provider_rate_limited",
          "Opsgenie rate limit reached.",
          429,
        );
      if (!response.ok)
        throw new OpsgenieCloudApiError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Opsgenie returned HTTP ${response.status}.`,
          response.status,
        );
      const declaredLength = Number(
        response.headers.get("content-length") ?? 0,
      );
      if (declaredLength > 1_000_000)
        throw new OpsgenieCloudApiError(
          "provider_validation_error",
          "Opsgenie response exceeds 1 MB.",
        );
      const text = await response.text();
      if (text.length > 1_000_000)
        throw new OpsgenieCloudApiError(
          "provider_validation_error",
          "Opsgenie response exceeds 1 MB.",
        );
      return text ? JSON.parse(text) : {};
    } catch (error) {
      if (error instanceof OpsgenieCloudApiError) throw error;
      throw new OpsgenieCloudApiError(
        "provider_unavailable",
        "Opsgenie could not be reached.",
        502,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private summary(value: unknown) {
    const alert = this.object(value);
    return {
      id: this.string(alert.id)?.slice(0, 100) ?? null,
      tinyId: this.string(alert.tinyId)?.slice(0, 30) ?? null,
      message: this.string(alert.message)?.slice(0, 500) ?? null,
      status: this.string(alert.status)?.slice(0, 30) ?? null,
      acknowledged: alert.acknowledged === true,
      seen: alert.isSeen === true,
      priority: this.string(alert.priority)?.slice(0, 10) ?? null,
      source: this.string(alert.source)?.slice(0, 200) ?? null,
      count: typeof alert.count === "number" ? alert.count : null,
      createdAt: this.string(alert.createdAt)?.slice(0, 50) ?? null,
      updatedAt: this.string(alert.updatedAt)?.slice(0, 50) ?? null,
    };
  }

  private validateCredentials(credentials: OpsgenieCloudCredentials) {
    if (!credentials.apiKey?.trim())
      throw new OpsgenieCloudApiError(
        "credential_missing",
        "Opsgenie API key is required.",
        401,
      );
    this.origin(credentials.region);
  }

  private origin(region: string) {
    if (region === "US") return "https://api.opsgenie.com";
    if (region === "EU") return "https://api.eu.opsgenie.com";
    throw new OpsgenieCloudApiError(
      "policy_blocked",
      "Opsgenie region must be US or EU.",
      403,
    );
  }

  private optionalStatus(value: unknown) {
    if (value === undefined || value === null || value === "") return undefined;
    if (value === "open" || value === "acknowledged" || value === "closed")
      return value;
    throw new OpsgenieCloudApiError(
      "provider_validation_error",
      "status must be open, acknowledged, or closed.",
    );
  }

  private requiredId(value: unknown) {
    const id = this.string(value)?.trim();
    if (!id || !/^[A-Za-z0-9-]{1,100}$/.test(id))
      throw new OpsgenieCloudApiError(
        "provider_validation_error",
        "alertId must be a provider alert ID.",
      );
    return id;
  }

  private integer(
    value: unknown,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const parsed =
      typeof value === "number" && Number.isInteger(value) ? value : fallback;
    return Math.max(minimum, Math.min(maximum, parsed));
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
