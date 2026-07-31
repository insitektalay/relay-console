import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type NutshellCredentials = { email: string; apiKey: string };

const API_ORIGIN = "https://app.nutshell.com";
const EMAIL = /^[^\s:@]+@[^\s:@]+\.[^\s:@]+$/;
const LEAD_ID = /^[1-9][0-9]{0,19}-leads$/;

export class NutshellApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class NutshellApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: NutshellCredentials) {
    const binding = this.binding(credentials);
    await this.send(credentials, "/rest/leads", {
      "page[page]": "0",
      "page[limit]": "1",
    });
    return {
      authorizingEmail: binding.email,
      apiOrigin: API_ORIGIN,
      reachable: true,
    };
  }

  async searchLeads(credentials: NutshellCredentials, input: JsonObject) {
    const binding = this.binding(credentials);
    const query = this.query(input.query);
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, "/rest/leads", {
      q: query,
      "page[page]": "0",
      "page[limit]": String(limit),
    });
    return {
      authorizingEmail: binding.email,
      leads: this.rows(body)
        .slice(0, limit)
        .map((row) => this.lead(row)),
      hasMore: this.hasMore(body),
    };
  }

  async getLead(credentials: NutshellCredentials, input: JsonObject) {
    const binding = this.binding(credentials);
    const leadId = this.leadId(input.leadId);
    const body = await this.send(credentials, `/rest/leads/${leadId}`);
    const lead = this.lead(this.rows(body)[0] ?? this.object(body));
    if (lead.leadId !== leadId) {
      throw new NutshellApiError(
        "provider_validation_error",
        "Nutshell returned a lead outside the requested binding.",
      );
    }
    return { authorizingEmail: binding.email, lead };
  }

  private async send(
    credentials: NutshellCredentials,
    path: "/rest/leads" | `/rest/leads/${string}`,
    query: Record<string, string> = {},
  ) {
    const binding = this.binding(credentials);
    const url = new URL(path, API_ORIGIN);
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
      throw new NutshellApiError(
        "provider_unavailable",
        "Nutshell is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new NutshellApiError(
        "provider_validation_error",
        "Nutshell response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new NutshellApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Nutshell API request failed.",
        response.status,
      );
    }
    try {
      return raw ? (JSON.parse(raw) as unknown) : {};
    } catch {
      throw new NutshellApiError(
        "provider_validation_error",
        "Nutshell returned an invalid response.",
      );
    }
  }

  private binding(credentials: NutshellCredentials) {
    const email = credentials.email.trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) {
      throw new NutshellApiError(
        "provider_validation_error",
        "Nutshell connection is not bound to a valid user email.",
      );
    }
    if (!credentials.apiKey.trim() || credentials.apiKey.length > 512) {
      throw new NutshellApiError(
        "credential_missing",
        "Nutshell API key is missing or invalid.",
      );
    }
    return { email };
  }

  private lead(row: JsonObject) {
    return {
      leadId: this.leadIdOrNull(row.id),
      number: this.scalar(row.number),
      name: this.scalar(row.name),
      status: this.scalar(row.status),
      confidence: this.scalar(row.confidence),
      value: this.scalar(row.value),
      priority: this.scalar(row.priority),
      createdTime: this.scalar(row.createdTime),
      closedTime: this.scalar(row.closedTime),
      lastContactedTime: this.scalar(row.lastContactedTime),
      nextActivityStartTime: this.scalar(row.nextActivityStartTime),
    };
  }

  private rows(value: unknown): JsonObject[] {
    if (Array.isArray(value)) return value.map((item) => this.object(item));
    const object = this.object(value);
    const rows = Array.isArray(object.leads) ? object.leads : [];
    return rows.map((item) => this.object(item));
  }

  private hasMore(value: unknown) {
    const object = this.object(value);
    const meta = this.object(object.meta);
    return (
      object.hasMore === true ||
      meta.hasMore === true ||
      (typeof meta.totalPages === "number" && meta.totalPages > 1)
    );
  }

  private leadId(value: unknown) {
    if (typeof value !== "string" || !LEAD_ID.test(value)) {
      throw new NutshellApiError(
        "provider_validation_error",
        "A valid Nutshell Lead API ID is required.",
      );
    }
    return value;
  }

  private leadIdOrNull(value: unknown) {
    return typeof value === "string" && LEAD_ID.test(value) ? value : null;
  }

  private query(value: unknown) {
    if (typeof value !== "string") {
      throw new NutshellApiError(
        "provider_validation_error",
        "Non-empty Nutshell lead search text is required.",
      );
    }
    const normalized = value.trim();
    if (!normalized || normalized.length > 100) {
      throw new NutshellApiError(
        "provider_validation_error",
        "Nutshell lead search text is outside the supported range.",
      );
    }
    return normalized;
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
      throw new NutshellApiError(
        "provider_validation_error",
        "Nutshell result limit is outside the supported range.",
      );
    }
    return Number(value);
  }
}
