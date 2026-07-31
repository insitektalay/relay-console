import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type OdooCredentials = { database: string; apiKey: string };

const DATABASE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PROJECT_FIELDS = [
  "id",
  "name",
  "active",
  "date_start",
  "date",
  "privacy_visibility",
  "write_date",
];

export class OdooApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class OdooApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: OdooCredentials) {
    const context = await this.context(credentials);
    if (!context.userId) {
      throw new OdooApiError(
        "provider_validation_error",
        "Odoo did not return the API-key-bound user.",
      );
    }
    return {
      database: this.credentials(credentials).database,
      userId: context.userId,
      reachable: true,
    };
  }

  async getCurrentUser(credentials: OdooCredentials) {
    return { user: await this.context(credentials) };
  }

  async listProjects(credentials: OdooCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const data = await this.send(
      credentials,
      "/json/2/project.project/search_read",
      {
        context: { lang: "en_US" },
        domain: [],
        fields: PROJECT_FIELDS,
        limit,
        offset: 0,
        order: "id asc",
      },
    );
    const rows = Array.isArray(data) ? data : [];
    return {
      database: this.credentials(credentials).database,
      projects: rows
        .slice(0, limit)
        .map((value) => this.project(this.object(value))),
      hasMore: rows.length >= limit,
    };
  }

  async getProject(credentials: OdooCredentials, input: JsonObject) {
    const projectId = this.positiveInteger(input.projectId, "Project");
    const data = await this.send(credentials, "/json/2/project.project/read", {
      ids: [projectId],
      context: { lang: "en_US" },
      fields: PROJECT_FIELDS,
      load: null,
    });
    const rows = Array.isArray(data) ? data : [];
    const project = this.project(this.object(rows[0]));
    if (rows.length !== 1 || project.projectId !== projectId) {
      throw new OdooApiError(
        "provider_validation_error",
        "Odoo returned a project outside the requested binding.",
      );
    }
    return { database: this.credentials(credentials).database, project };
  }

  private async context(credentials: OdooCredentials) {
    const data = this.object(
      await this.send(credentials, "/json/2/res.users/context_get", {}),
    );
    return {
      userId: this.integerOrNull(data.uid ?? data.user_id),
      language: this.scalar(data.lang),
      timezone: this.scalar(data.tz),
    };
  }

  private async send(
    credentials: OdooCredentials,
    path:
      | "/json/2/res.users/context_get"
      | "/json/2/project.project/search_read"
      | "/json/2/project.project/read",
    body: JsonObject,
  ): Promise<unknown> {
    const validated = this.credentials(credentials);
    const url = `https://${validated.database}.odoo.com${path}`;
    let response: Response;
    try {
      response = await this.request(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `bearer ${validated.apiKey}`,
          "Content-Type": "application/json; charset=utf-8",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
          "X-Odoo-Database": validated.database,
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new OdooApiError(
        "provider_unavailable",
        "Odoo is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new OdooApiError(
        "provider_validation_error",
        "Odoo response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new OdooApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Odoo API request failed.",
        response.status,
      );
    }
    try {
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      throw new OdooApiError(
        "provider_validation_error",
        "Odoo returned an invalid response.",
      );
    }
  }

  private credentials(credentials: OdooCredentials) {
    const database = credentials.database.trim().toLowerCase();
    if (!DATABASE.test(database)) {
      throw new OdooApiError(
        "provider_validation_error",
        "A valid Odoo Online database name is required.",
      );
    }
    if (!credentials.apiKey.trim() || credentials.apiKey.length > 8192) {
      throw new OdooApiError(
        "credential_missing",
        "Odoo API key is missing or invalid.",
      );
    }
    return { database, apiKey: credentials.apiKey };
  }

  private project(row: JsonObject) {
    return {
      projectId: this.integerOrNull(row.id),
      name: this.scalar(row.name),
      active: this.scalar(row.active),
      startDate: this.scalar(row.date_start),
      endDate: this.scalar(row.date),
      privacyVisibility: this.scalar(row.privacy_visibility),
      updatedAt: this.scalar(row.write_date),
    };
  }

  private positiveInteger(value: unknown, label: string) {
    if (!Number.isSafeInteger(value) || Number(value) < 1) {
      throw new OdooApiError(
        "provider_validation_error",
        `A valid Odoo ${label} ID is required.`,
      );
    }
    return Number(value);
  }

  private integerOrNull(value: unknown) {
    return Number.isSafeInteger(value) && Number(value) > 0
      ? Number(value)
      : null;
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new OdooApiError(
        "provider_validation_error",
        "Odoo result limit is outside the supported range.",
      );
    }
    return Number(value);
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
