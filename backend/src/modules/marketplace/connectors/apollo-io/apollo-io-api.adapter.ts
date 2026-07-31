import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ApolloIoOperationInput = {
  query?: unknown;
  page?: unknown;
  limit?: unknown;
};
export const APOLLO_IO_READ_OPERATIONS = [
  "people.search",
  "contacts.search",
] as const;

export class ApolloIoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ApolloIoApiAdapter {
  health(accessToken: string) {
    return this.request(accessToken, "contacts.search", {
      query: "relay-health-check",
      page: 1,
      limit: 1,
    });
  }

  read(accessToken: string, operation: string, input: ApolloIoOperationInput) {
    this.rejectUnknownInput(input);
    if (!APOLLO_IO_READ_OPERATIONS.includes(operation as never))
      throw new ApolloIoApiError(
        "policy_blocked",
        "Apollo operation is not in Relay's pinned search contract.",
        403,
      );
    return this.request(
      accessToken,
      operation as (typeof APOLLO_IO_READ_OPERATIONS)[number],
      {
        query: this.query(input.query),
        page: this.integer(input.page, "page", 1, 500, 1),
        limit: this.integer(input.limit, "limit", 1, 25, 10),
      },
    );
  }

  private async request(
    accessToken: string,
    operation: (typeof APOLLO_IO_READ_OPERATIONS)[number],
    input: { query: string; page: number; limit: number },
  ) {
    this.requireToken(accessToken);
    const root = new URL("https://api.apollo.io/api/v1/");
    const path =
      operation === "people.search"
        ? "mixed_people/api_search"
        : "contacts/search";
    const url = new URL(path, root);
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new ApolloIoApiError(
        "policy_blocked",
        "Apollo requests must stay on the HTTPS API v1 route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: JSON.stringify({
          q_keywords: input.query,
          page: input.page,
          per_page: input.limit,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ApolloIoApiError(
        "provider_unavailable",
        "Apollo could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Apollo response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new ApolloIoApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Apollo returned HTTP ${response.status}.`,
        response.status,
      );
    return this.summaries(operation, data);
  }

  private summaries(
    operation: (typeof APOLLO_IO_READ_OPERATIONS)[number],
    value: unknown,
  ) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const key = operation === "people.search" ? "people" : "contacts";
    const rows = Array.isArray(body[key]) ? body[key].slice(0, 25) : [];
    return {
      pagination: body.pagination,
      [key]: rows.map((item) => this.personSummary(item)),
    };
  }

  private personSummary(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const person = value as JsonObject;
    const summary = Object.fromEntries(
      [
        "id",
        "first_name",
        "last_name",
        "name",
        "title",
        "headline",
        "city",
        "state",
        "country",
        "contact_stage_id",
        "created_at",
        "updated_at",
      ]
        .filter((key) => person[key] !== undefined)
        .map((key) => [key, person[key]]),
    );
    const organization = this.object(person.organization);
    if (Object.keys(organization).length)
      summary.organization = Object.fromEntries(
        ["id", "name", "website_url", "industry"]
          .filter((key) => organization[key] !== undefined)
          .map((key) => [key, organization[key]]),
      );
    return summary;
  }

  private query(value: unknown) {
    const query = String(value ?? "").trim();
    if (query.length < 2 || query.length > 160 || /[\r\n]/.test(query))
      throw this.invalid("query must contain 2 to 160 single-line characters.");
    return query;
  }

  private integer(
    value: unknown,
    name: string,
    min: number,
    max: number,
    fallback: number,
  ) {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max)
      throw this.invalid(`${name} must be an integer from ${min} to ${max}.`);
    return number;
  }

  private rejectUnknownInput(input: ApolloIoOperationInput) {
    const allowed = new Set(["query", "page", "limit"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new ApolloIoApiError(
        "policy_blocked",
        "Apollo accepts only pinned search inputs.",
        403,
      );
  }

  private requireToken(accessToken: string) {
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new ApolloIoApiError(
        "credential_missing",
        "A valid Apollo OAuth access token is required.",
        401,
      );
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 25).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 500_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie|email|phone|linkedin|facebook|twitter|github|photo|avatar|personal)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    const body = this.object(value);
    const candidate = body.message ?? body.error ?? body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new ApolloIoApiError("provider_validation_error", message, 400);
  }
}
