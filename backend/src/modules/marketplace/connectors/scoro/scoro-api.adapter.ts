import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type ScoroCredentials = {
  site: string;
  companyAccountId: string;
  apiKey: string;
};

const SITE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ACCOUNT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export class ScoroApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class ScoroApiAdapter {
  constructor(
    private readonly request: HttpClient = fetch,
    private readonly appId = process.env.SCORO_APP_ID?.trim() ?? "",
  ) {}

  async health(credentials: ScoroCredentials) {
    const entity = await this.businessEntity(credentials);
    return {
      site: credentials.site,
      companyAccountId: entity.entityId,
      reachable: true,
    };
  }

  async getBusinessEntity(credentials: ScoroCredentials) {
    return { businessEntity: await this.businessEntity(credentials) };
  }

  async listProjects(credentials: ScoroCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, "/projects/list", {
      page: 1,
      per_page: limit,
      request: {},
    });
    const rows = Array.isArray(body.data) ? body.data : [];
    return {
      site: credentials.site,
      companyAccountId: credentials.companyAccountId,
      projects: rows
        .slice(0, limit)
        .map((value) => this.project(this.object(value))),
      hasMore: rows.length >= limit,
    };
  }

  async getProject(credentials: ScoroCredentials, input: JsonObject) {
    const projectId = this.positiveInteger(input.projectId, "Project");
    const body = await this.send(credentials, `/projects/view/${projectId}`, {
      request: {},
    });
    const project = this.project(this.object(body.data));
    if (project.projectId !== projectId) {
      throw new ScoroApiError(
        "provider_validation_error",
        "Scoro returned a project outside the requested binding.",
      );
    }
    return {
      site: credentials.site,
      companyAccountId: credentials.companyAccountId,
      project,
    };
  }

  private async businessEntity(credentials: ScoroCredentials) {
    const body = await this.send(credentials, "/companyAccount/list", {});
    const site = this.object(
      Array.isArray(body.data) ? body.data[0] : body.data,
    );
    const entities = Array.isArray(site.active_entities)
      ? site.active_entities.map((value) => this.object(value))
      : [];
    const match = entities.find(
      (entity) => entity.entity_id === credentials.companyAccountId,
    );
    if (!match) {
      throw new ScoroApiError(
        "provider_validation_error",
        "Scoro did not return the exact configured business entity.",
      );
    }
    return {
      entityId: credentials.companyAccountId,
      entityName: this.scalar(match.entity_name),
      baseCurrency: this.scalar(site.base_currency),
      language: this.scalar(site.language),
    };
  }

  private async send(
    credentials: ScoroCredentials,
    path:
      | "/companyAccount/list"
      | "/projects/list"
      | `/projects/view/${number}`,
    extra: JsonObject,
  ) {
    const validated = this.credentials(credentials);
    if (!this.appId || this.appId.length > 512) {
      throw new ScoroApiError(
        "credential_missing",
        "Scoro public integration AppId is not configured.",
      );
    }
    const url = `https://${validated.site}.scoro.com/api/v2${path}`;
    let response: Response;
    try {
      response = await this.request(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
          "scoro-app-id": this.appId,
        },
        body: JSON.stringify({
          apiKey: validated.apiKey,
          lang: "eng",
          company_account_id: validated.companyAccountId,
          ...extra,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ScoroApiError(
        "provider_unavailable",
        "Scoro is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new ScoroApiError(
        "provider_validation_error",
        "Scoro response exceeded the safe size limit.",
      );
    }
    let parsed: JsonObject;
    try {
      parsed = this.object(raw ? (JSON.parse(raw) as unknown) : {});
    } catch {
      throw new ScoroApiError(
        "provider_validation_error",
        "Scoro returned an invalid response.",
      );
    }
    const providerStatus = Number(parsed.statusCode);
    if (!response.ok || parsed.status === "ERROR" || providerStatus >= 400) {
      const status = response.ok ? providerStatus || 400 : response.status;
      throw new ScoroApiError(
        status === 401 || status === 403
          ? "credential_missing"
          : status === 429
            ? "provider_rate_limited"
            : status === 408 || status >= 500
              ? "provider_unavailable"
              : "provider_validation_error",
        "Scoro API request failed.",
        status,
      );
    }
    return parsed;
  }

  private credentials(credentials: ScoroCredentials) {
    const site = credentials.site.trim().toLowerCase();
    const companyAccountId = credentials.companyAccountId.trim();
    if (!SITE.test(site)) {
      throw new ScoroApiError(
        "provider_validation_error",
        "A valid Scoro tenant subdomain is required.",
      );
    }
    if (!ACCOUNT.test(companyAccountId)) {
      throw new ScoroApiError(
        "provider_validation_error",
        "A valid Scoro business entity ID is required.",
      );
    }
    if (!credentials.apiKey.trim() || credentials.apiKey.length > 8192) {
      throw new ScoroApiError(
        "credential_missing",
        "Scoro API key is missing or invalid.",
      );
    }
    return { site, companyAccountId, apiKey: credentials.apiKey };
  }

  private project(row: JsonObject) {
    return {
      projectId: this.integerOrNull(row.project_id ?? row.id),
      number: this.scalar(row.no),
      name: this.scalar(row.project_name),
      status: this.scalar(row.status),
      isPersonal: this.scalar(row.is_personal),
      isPrivate: this.scalar(row.is_private),
      startDate: this.scalar(row.date),
      deadline: this.scalar(row.deadline),
      duration: this.scalar(row.duration),
      projectType: this.scalar(row.project_type),
      budgetType: this.scalar(row.budget_type),
      revenueCalculationModel: this.scalar(row.revenue_calc_model),
      modifiedAt: this.scalar(row.modified_date),
    };
  }

  private positiveInteger(value: unknown, label: string) {
    if (!Number.isSafeInteger(value) || Number(value) < 1) {
      throw new ScoroApiError(
        "provider_validation_error",
        `A valid Scoro ${label} ID is required.`,
      );
    }
    return Number(value);
  }

  private integerOrNull(value: unknown) {
    const number = typeof value === "string" ? Number(value) : value;
    return Number.isSafeInteger(number) && Number(number) > 0
      ? Number(number)
      : null;
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new ScoroApiError(
        "provider_validation_error",
        "Scoro result limit is outside the supported range.",
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
