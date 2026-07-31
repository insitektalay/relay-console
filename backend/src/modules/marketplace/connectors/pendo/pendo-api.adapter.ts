import { Injectable } from "@nestjs/common";

export type PendoCredentials = {
  apiOrigin: string;
  applicationId: string;
  integrationKey: string;
};

export class PendoApiError extends Error {
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
type DefinitionKind = "page" | "feature" | "guide";

const API_ORIGINS = new Set([
  "https://app.pendo.io",
  "https://app.eu.pendo.io",
  "https://us1.app.pendo.io",
  "https://app.jpn.pendo.io",
  "https://app.au.pendo.io",
]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const APPLICATION_ID = /^-?\d{1,16}$/;
const DEFINITION_PATHS: Record<DefinitionKind, string> = {
  page: "/api/v1/page",
  feature: "/api/v1/feature",
  guide: "/api/v1/guide",
};

@Injectable()
export class PendoApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: PendoCredentials) {
    const applicationId = this.applicationId(credentials.applicationId);
    await this.send(credentials, "/api/v1/token/verify", "GET");
    return {
      apiOrigin: this.origin(credentials.apiOrigin),
      applicationId,
      integrationKeyValid: true,
      reachable: true,
    };
  }

  async applicationBinding(credentials: PendoCredentials) {
    return this.health(credentials);
  }

  async listDefinitions(
    credentials: PendoCredentials,
    input: Record<string, unknown>,
  ) {
    const kind = this.definitionKind(input.kind);
    const applicationId = this.applicationId(credentials.applicationId);
    const query = new URLSearchParams({ appId: applicationId });
    const body = await this.send(
      credentials,
      `${DEFINITION_PATHS[kind]}?${query.toString()}`,
      "GET",
    );
    const rows = Array.isArray(body) ? body : [];
    return {
      applicationId,
      kind,
      items: rows.slice(0, 25).map((value) => {
        const row = this.object(value);
        return {
          id: this.text(row.id, 256),
          name: this.text(row.name, 256),
          kind: this.text(row.kind, 32) || kind,
          appId: this.identifier(row.appId),
          state: kind === "guide" ? this.text(row.state, 32) : null,
          isCoreEvent:
            kind === "guide" || typeof row.isCoreEvent !== "boolean"
              ? null
              : row.isCoreEvent,
        };
      }),
    };
  }

  async getAdoption(
    credentials: PendoCredentials,
    input: Record<string, unknown>,
  ) {
    const range = this.range(input);
    const applicationId = this.applicationId(credentials.applicationId);
    const numericApplicationId = Number(applicationId);
    if (!Number.isSafeInteger(numericApplicationId)) {
      throw new PendoApiError(
        "pendo_application_id_invalid",
        "Pendo Application ID must be a safe integer.",
      );
    }
    const body = await this.send(credentials, "/api/v1/aggregation", "POST", {
      response: { mimeType: "application/json" },
      request: {
        name: "Relay bounded application adoption",
        pipeline: [
          {
            adoption: {
              appId: numericApplicationId,
              firstDay: `date("${range.fromDate}")`,
              lastDay: `date("${range.toDate}")`,
            },
          },
        ],
      },
    });
    const results = this.array(this.object(body).results);
    const adoption = this.object(results[0]).adoption;
    return {
      applicationId,
      fromDate: range.fromDate,
      toDate: range.toDate,
      adoptionPercent:
        typeof adoption === "number" && Number.isFinite(adoption)
          ? adoption
          : null,
    };
  }

  private async send(
    credentials: PendoCredentials,
    path: string,
    method: "GET" | "POST",
    body?: Record<string, unknown>,
  ) {
    const origin = this.origin(credentials.apiOrigin);
    const integrationKey = credentials.integrationKey.trim();
    if (integrationKey.length < 8 || integrationKey.length > 4096) {
      throw new PendoApiError(
        "pendo_integration_key_invalid",
        "Pendo Integration Key is missing or invalid.",
      );
    }
    const url = new URL(path, origin);
    if (
      url.origin !== origin ||
      ![
        "/api/v1/token/verify",
        "/api/v1/page",
        "/api/v1/feature",
        "/api/v1/guide",
        "/api/v1/aggregation",
      ].includes(url.pathname)
    ) {
      throw new PendoApiError(
        "pendo_request_invalid",
        "Pendo request escaped the fixed Engage API boundary.",
      );
    }
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-pendo-integration-key": integrationKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new PendoApiError(
        "pendo_unavailable",
        "Pendo is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000) {
      throw new PendoApiError(
        "pendo_response_too_large",
        "Pendo response exceeded the safe size limit.",
      );
    }
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      throw new PendoApiError(
        "pendo_response_invalid",
        "Pendo returned an invalid response.",
      );
    }
    if (!response.ok) {
      throw new PendoApiError(
        response.status === 401
          ? "pendo_integration_key_invalid"
          : response.status === 403
            ? "pendo_permission_denied"
            : response.status === 429
              ? "pendo_rate_limited"
              : "pendo_http_error",
        "Pendo Engage API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    }
    return parsed;
  }

  private range(input: Record<string, unknown>) {
    const fromDate = this.date(input.fromDate, "fromDate");
    const toDate = this.date(input.toDate, "toDate");
    const start = Date.parse(`${fromDate}T00:00:00Z`);
    const end = Date.parse(`${toDate}T00:00:00Z`);
    if (end < start || end - start > 30 * 86_400_000) {
      throw new PendoApiError(
        "pendo_date_range_invalid",
        "Pendo date range must be ordered and contain at most 31 days.",
      );
    }
    return { fromDate, toDate };
  }

  private date(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !DATE.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    ) {
      throw new PendoApiError(
        "pendo_date_invalid",
        `A valid ${label} date in YYYY-MM-DD format is required.`,
      );
    }
    return value;
  }

  private definitionKind(value: unknown): DefinitionKind {
    if (value === "page" || value === "feature" || value === "guide") {
      return value;
    }
    throw new PendoApiError(
      "pendo_definition_kind_invalid",
      "Pendo definition kind must be page, feature, or guide.",
    );
  }

  private applicationId(value: string) {
    const applicationId = value.trim();
    if (!APPLICATION_ID.test(applicationId)) {
      throw new PendoApiError(
        "pendo_application_id_invalid",
        "Pendo Application ID is missing or invalid.",
      );
    }
    return applicationId;
  }

  private origin(raw: string) {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      throw new PendoApiError(
        "pendo_api_origin_invalid",
        "Pendo API origin is invalid.",
      );
    }
    if (
      !API_ORIGINS.has(url.origin) ||
      url.protocol !== "https:" ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new PendoApiError(
        "pendo_api_origin_invalid",
        "Pendo connection is not bound to an official Engage API region.",
      );
    }
    return url.origin;
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private identifier(value: unknown) {
    return typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value))
      ? String(value).slice(0, 64)
      : null;
  }
}
