import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type FreshdeskCredentials = {
  domain: string;
  apiKey: string;
};

export class FreshdeskApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FreshdeskApiAdapter {
  health(credentials: FreshdeskCredentials) {
    return this.listTickets(credentials, { perPage: 1 });
  }

  listTickets(credentials: FreshdeskCredentials, input: JsonObject = {}) {
    return this.request(credentials, {
      method: "GET",
      path: "/api/v2/tickets",
      query: {
        page: this.integer(input.page, 1, 1, 10_000),
        per_page: this.integer(input.perPage, 30, 1, 100),
        updated_since: this.optionalDateTime(input.updatedSince),
        order_by: this.enumValue(input.orderBy, [
          "created_at",
          "due_by",
          "updated_at",
          "status",
        ]),
        order_type: this.enumValue(input.orderType, ["asc", "desc"]),
      },
    });
  }

  getTicket(credentials: FreshdeskCredentials, input: JsonObject) {
    const ticketId = this.positiveInteger(input.ticketId, "ticketId");
    return this.request(credentials, {
      method: "GET",
      path: `/api/v2/tickets/${ticketId}`,
      query: {
        include: this.enumValue(input.include, [
          "requester",
          "company",
          "stats",
          "description",
        ]),
      },
    });
  }

  async request(
    credentials: FreshdeskCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const domain = this.domain(credentials.domain);
    if (!credentials.apiKey.trim()) {
      throw new FreshdeskApiError(
        "credential_missing",
        "Freshdesk API key is required.",
        401,
      );
    }
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/v2\/[A-Za-z0-9_./-]+$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    ) {
      throw new FreshdeskApiError(
        "provider_validation_error",
        "Freshdesk method or API v2 path is invalid.",
      );
    }
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) {
      throw new FreshdeskApiError(
        "provider_validation_error",
        "Freshdesk request body exceeds the 1 MB Relay boundary.",
      );
    }

    const url = new URL(`https://${domain}.freshdesk.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const response = await safeConnectorFetch(url, {
      method,
      redirect: "error",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:X`).toString("base64")}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000) {
      throw new FreshdeskApiError(
        "provider_validation_error",
        "Freshdesk response exceeds the 2 MB Relay boundary.",
      );
    }
    const raw = await response.text();
    const text = raw.slice(0, 2_000_000);
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    const safe = this.redact(parsed);
    if (!response.ok) {
      throw new FreshdeskApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ??
          `Freshdesk returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return {
      status: response.status,
      data: safe,
      pagination: {
        link: response.headers.get("link"),
        total: response.headers.get("x-total-count"),
      },
      rateLimit: {
        total: response.headers.get("x-ratelimit-total"),
        remaining: response.headers.get("x-ratelimit-remaining"),
        usedCurrentRequest: response.headers.get(
          "x-ratelimit-used-currentrequest",
        ),
      },
      truncated: raw.length > text.length,
    };
  }

  private domain(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.freshdesk\.com\/?$/, "")
      .replace(/\/$/, "");
    if (
      !normalized ||
      normalized.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
    ) {
      throw new FreshdeskApiError(
        "provider_validation_error",
        "Freshdesk domain must be the account name before .freshdesk.com.",
      );
    }
    return normalized;
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12) {
        throw new FreshdeskApiError(
          "policy_blocked",
          "Freshdesk request is too deeply nested.",
          403,
        );
      }
      if (Array.isArray(item)) {
        item.forEach((entry) => walk(entry, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new FreshdeskApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        }
        walk(entry, depth + 1);
      }
    };
    walk(value);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) {
      throw new FreshdeskApiError(
        "provider_validation_error",
        "Freshdesk query has too many fields.",
      );
    }
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item.slice(0, 100) : [item];
      values.forEach((entry) =>
        params.append(key, String(entry).slice(0, 10_000)),
      );
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const object = value as JsonObject;
    const candidate = object.description ?? object.message ?? object.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private optionalDateTime(value: unknown) {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
      throw new FreshdeskApiError(
        "provider_validation_error",
        "updatedSince must be an ISO 8601 date-time.",
      );
    }
    return new Date(value).toISOString();
  }

  private enumValue(value: unknown, allowed: string[]) {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw new FreshdeskApiError(
        "provider_validation_error",
        `Value must be one of ${allowed.join(", ")}.`,
      );
    }
    return value;
  }

  private positiveInteger(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new FreshdeskApiError(
        "provider_validation_error",
        `${field} must be a positive integer.`,
      );
    }
    return number;
  }

  private integer(
    value: unknown,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const number = Number(value ?? fallback);
    return Number.isSafeInteger(number) &&
      number >= minimum &&
      number <= maximum
      ? number
      : fallback;
  }
}
