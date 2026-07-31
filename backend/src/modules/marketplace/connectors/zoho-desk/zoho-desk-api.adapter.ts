import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

const ID = /^[1-9][0-9]{0,24}$/;
const API_ORIGINS = new Set([
  "https://desk.zoho.com",
  "https://desk.zoho.eu",
  "https://desk.zoho.in",
  "https://desk.zoho.com.au",
  "https://desk.zohocloud.ca",
  "https://desk.zoho.sa",
  "https://desk.zoho.jp",
  "https://desk.zoho.com.cn",
  "https://desk.zoho.sg",
  "https://desk.zoho.ae",
]);

export type ZohoDeskCredentials = {
  accessToken: string;
  apiOrigin: string;
  organizationId: string;
};

export class ZohoDeskApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class ZohoDeskApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ZohoDeskCredentials) {
    const body = await this.send(credentials, "/api/v1/accessibleOrganizations");
    const exact = this.rows(body).find(
      (row) => this.id(row.id) === credentials.organizationId,
    );
    if (!exact)
      throw new ZohoDeskApiError(
        "provider_validation_error",
        "Zoho Desk did not return the consent-bound organization.",
      );
    return {
      organizationId: credentials.organizationId,
      organizationName: this.text(exact.companyName),
      reachable: true,
    };
  }

  async listTickets(
    credentials: ZohoDeskCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      from: "1",
      limit: String(limit),
      sortBy: "-modifiedTime",
    });
    const body = await this.send(
      credentials,
      `/api/v1/tickets?${query.toString()}`,
    );
    return {
      organizationId: credentials.organizationId,
      tickets: this.rows(body)
        .slice(0, limit)
        .map((row) => this.ticket(row)),
      nextPageFollowed: false,
    };
  }

  async getTicket(
    credentials: ZohoDeskCredentials,
    input: Record<string, unknown>,
  ) {
    const ticketId = typeof input.ticketId === "string" ? input.ticketId : "";
    if (!ID.test(ticketId))
      throw new ZohoDeskApiError(
        "provider_validation_error",
        "A positive numeric Zoho Desk ticket ID is required.",
      );
    const body = await this.send(credentials, `/api/v1/tickets/${ticketId}`);
    return {
      organizationId: credentials.organizationId,
      ticket: this.ticket(this.object(body)),
    };
  }

  private async send(credentials: ZohoDeskCredentials, path: string) {
    const validated = this.credentials(credentials);
    let response: Response;
    try {
      response = await this.request(`${validated.apiOrigin}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Zoho-oauthtoken ${validated.accessToken}`,
          orgId: validated.organizationId,
          "User-Agent": "RelayConsole-ZohoDesk/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ZohoDeskApiError(
        "provider_unavailable",
        "Zoho Desk is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new ZohoDeskApiError(
        "provider_validation_error",
        "Zoho Desk response exceeded the safe size limit.",
      );
    if (!response.ok)
      throw new ZohoDeskApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Zoho Desk API request failed.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new ZohoDeskApiError(
        "provider_validation_error",
        "Zoho Desk returned an invalid response.",
      );
    }
  }

  private credentials(credentials: ZohoDeskCredentials) {
    const accessToken = credentials.accessToken.trim();
    if (!accessToken || accessToken.length > 16_384)
      throw new ZohoDeskApiError(
        "credential_missing",
        "Zoho Desk OAuth credentials are missing or invalid.",
      );
    if (!ID.test(credentials.organizationId))
      throw new ZohoDeskApiError(
        "provider_validation_error",
        "A valid consent-bound Zoho Desk organization is required.",
      );
    let apiOrigin = "";
    try {
      const url = new URL(credentials.apiOrigin);
      apiOrigin = url.origin;
      if (url.origin !== credentials.apiOrigin || !API_ORIGINS.has(apiOrigin))
        throw new Error();
    } catch {
      throw new ZohoDeskApiError(
        "provider_validation_error",
        "Zoho Desk regional API origin is invalid.",
      );
    }
    return { accessToken, organizationId: credentials.organizationId, apiOrigin };
  }

  private ticket(row: JsonObject) {
    return {
      ticketId: this.id(row.id),
      ticketNumber: this.text(row.ticketNumber),
      subject: this.text(row.subject),
      status: this.text(row.status),
      priority: this.text(row.priority),
      classification: this.text(row.classification),
      category: this.text(row.category),
      subCategory: this.text(row.subCategory),
      channel: this.text(row.channel),
      language: this.text(row.language),
      departmentId: this.id(row.departmentId),
      productId: this.id(row.productId),
      dueDate: this.text(row.dueDate),
      createdTime: this.text(row.createdTime),
      modifiedTime: this.text(row.modifiedTime),
    };
  }

  private rows(body: JsonObject) {
    return Array.isArray(body.data) ? body.data.map((row) => this.object(row)) : [];
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private id(value: unknown) {
    const candidate =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : typeof value === "string"
          ? value
          : "";
    return ID.test(candidate) ? candidate : null;
  }
  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 512) : null;
  }
  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new ZohoDeskApiError(
        "provider_validation_error",
        "Zoho Desk ticket limit must be between 1 and 25.",
      );
    return Number(value);
  }
}
