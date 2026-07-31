import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type AgileCrmCredentials = {
  domain: string;
  email: string;
  apiKey: string;
};

const DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL = /^[^\s:@]+@[^\s:@]+\.[^\s:@]+$/;
const ID = /^[1-9][0-9]{0,19}$/;

export class AgileCrmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class AgileCrmApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: AgileCrmCredentials) {
    const binding = this.binding(credentials);
    await this.send(credentials, "/opportunity", { page_size: "1" });
    return {
      tenantHost: binding.tenantHost,
      authorizingEmail: binding.email,
      apiVersion: "dev/api",
      reachable: true,
    };
  }

  async listDeals(credentials: AgileCrmCredentials, input: JsonObject) {
    const binding = this.binding(credentials);
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, "/opportunity", {
      page_size: String(limit),
    });
    const rows = Array.isArray(body) ? body : [];
    return {
      tenantHost: binding.tenantHost,
      deals: rows.slice(0, limit).map((value) => this.deal(this.object(value))),
      hasMore: rows.some(
        (value) => typeof this.object(value).cursor === "string",
      ),
    };
  }

  async getDeal(credentials: AgileCrmCredentials, input: JsonObject) {
    const binding = this.binding(credentials);
    const dealId = this.dealId(input.dealId);
    const body = this.object(
      await this.send(credentials, `/opportunity/${dealId}`),
    );
    const deal = this.deal(body);
    if (deal.dealId !== dealId) {
      throw new AgileCrmApiError(
        "provider_validation_error",
        "Agile CRM returned a deal outside the requested binding.",
      );
    }
    return { tenantHost: binding.tenantHost, deal };
  }

  private async send(
    credentials: AgileCrmCredentials,
    path: "/opportunity" | `/opportunity/${string}`,
    query: Record<string, string> = {},
  ) {
    const binding = this.binding(credentials);
    const url = new URL(`/dev/api${path}`, binding.origin);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            `${binding.email}:${credentials.apiKey}`,
            "utf8",
          ).toString("base64")}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AgileCrmApiError(
        "provider_unavailable",
        "Agile CRM is temporarily unavailable.",
        502,
      );
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new AgileCrmApiError(
        "provider_validation_error",
        "Agile CRM response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new AgileCrmApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Agile CRM API request failed.",
        response.status,
      );
    }
    if (!raw) return [];
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new AgileCrmApiError(
        "provider_validation_error",
        "Agile CRM returned an invalid response.",
      );
    }
  }

  private binding(credentials: AgileCrmCredentials) {
    const domain = credentials.domain.trim().toLowerCase();
    const email = credentials.email.trim();
    if (!DOMAIN.test(domain)) {
      throw new AgileCrmApiError(
        "provider_validation_error",
        "Agile CRM connection is not bound to a valid tenant domain.",
      );
    }
    if (email.length > 254 || !EMAIL.test(email)) {
      throw new AgileCrmApiError(
        "provider_validation_error",
        "Agile CRM connection is not bound to a valid account email.",
      );
    }
    if (!credentials.apiKey.trim() || credentials.apiKey.length > 512) {
      throw new AgileCrmApiError(
        "credential_missing",
        "Agile CRM REST API key is missing or invalid.",
      );
    }
    const tenantHost = `${domain}.agilecrm.com`;
    return { domain, email, tenantHost, origin: `https://${tenantHost}` };
  }

  private dealId(value: unknown) {
    if (typeof value !== "string" || !ID.test(value)) {
      throw new AgileCrmApiError(
        "provider_validation_error",
        "A positive numeric Agile CRM Deal ID is required.",
      );
    }
    return value;
  }

  private deal(row: JsonObject) {
    return {
      dealId: this.id(row.id),
      name: this.scalar(row.name),
      expectedValue: this.scalar(row.expected_value),
      pipelineId: this.scalar(row.pipeline_id),
      milestone: this.scalar(row.milestone),
      probability: this.scalar(row.probability),
      closeDate: this.scalar(row.close_date),
      createdTime: this.scalar(row.created_time),
      archived: this.scalar(row.archived),
    };
  }

  private id(value: unknown) {
    const normalized =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : value;
    return typeof normalized === "string" && ID.test(normalized)
      ? normalized
      : null;
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

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new AgileCrmApiError(
        "provider_validation_error",
        "Agile CRM result limit is outside the supported range.",
      );
    }
    return Number(value);
  }
}
