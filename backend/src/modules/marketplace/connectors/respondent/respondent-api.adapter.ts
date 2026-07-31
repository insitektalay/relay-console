import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type RespondentCredentials = { clientId: string; clientSecret: string };
export type RespondentOperationInput = {
  page?: unknown;
  limit?: unknown;
  query?: unknown;
};
export const RESPONDENT_READ_OPERATIONS = [
  "industries.list",
  "job-titles.list",
  "skills.list",
  "topics.list",
] as const;

export class RespondentApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RespondentApiAdapter {
  health(credentials: RespondentCredentials) {
    return this.read(credentials, "industries.list", { limit: 1 });
  }

  read(
    credentials: RespondentCredentials,
    operation: string,
    input: RespondentOperationInput,
  ) {
    this.requireCredentials(credentials);
    this.rejectUnknownInput(input);
    if (!RESPONDENT_READ_OPERATIONS.includes(operation as never))
      throw new RespondentApiError(
        "policy_blocked",
        "Respondent operation is outside Relay's pinned taxonomy-only contract.",
        403,
      );
    const target = operation.replace(".list", "");
    const query: Record<string, string | number | boolean> = {
      page: this.integer(input.page, "page", 1, 10_000, 1),
      pageSize: this.integer(input.limit, "limit", 1, 25, 20),
      includeCount: false,
    };
    if (input.query !== undefined) {
      if (operation === "industries.list")
        throw this.invalid("query is not supported for industries.list.");
      query.query = this.searchQuery(input.query);
    }
    return this.request(credentials, target, query, operation);
  }

  private async request(
    credentials: RespondentCredentials,
    target: string,
    query: Record<string, string | number | boolean>,
    operation: string,
  ) {
    const root = new URL("https://api.respondent.io/v1/");
    const url = new URL(target, root);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new RespondentApiError(
        "policy_blocked",
        "Respondent requests must stay on the production HTTPS API route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": credentials.clientId,
          "x-api-secret": credentials.clientSecret,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new RespondentApiError(
        "provider_unavailable",
        "Respondent could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Respondent response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new RespondentApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Respondent returned HTTP ${response.status}.`,
        response.status,
      );
    return this.minimize(data, operation);
  }

  private minimize(value: unknown, operation: string) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const fields =
      operation === "industries.list"
        ? ["id", "name", "createdAt", "updatedAt"]
        : operation === "job-titles.list"
          ? ["id", "name"]
          : operation === "skills.list"
            ? ["id", "name", "slug", "type", "validated"]
            : ["id", "name", "customName", "createdAt", "updatedAt"];
    return {
      page: body.page,
      pageSize: body.pageSize,
      results: Array.isArray(body.results)
        ? body.results.slice(0, 25).map((item) => this.pick(item, fields))
        : [],
    };
  }

  private pick(value: unknown, fields: string[]) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const item = value as JsonObject;
    return Object.fromEntries(
      fields
        .filter((field) => item[field] !== undefined)
        .map((field) => [field, item[field]]),
    );
  }

  private requireCredentials(credentials: RespondentCredentials) {
    if (
      !credentials.clientId ||
      !credentials.clientSecret ||
      credentials.clientId.length > 16_000 ||
      credentials.clientSecret.length > 16_000 ||
      /[\r\n]/.test(credentials.clientId) ||
      /[\r\n]/.test(credentials.clientSecret)
    )
      throw new RespondentApiError(
        "credential_missing",
        "Valid Respondent Client ID and Client Secret values are required.",
        401,
      );
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

  private searchQuery(value: unknown) {
    const query = String(value ?? "").trim();
    if (query.length < 3 || query.length > 100 || /[\r\n]/.test(query))
      throw this.invalid("query must contain 3 to 100 single-line characters.");
    return query;
  }

  private rejectUnknownInput(input: RespondentOperationInput) {
    const allowed = new Set(["page", "limit", "query"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new RespondentApiError(
        "policy_blocked",
        "Respondent accepts only pinned taxonomy operation inputs.",
        403,
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
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 25).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|email|phone|linkedin|profile|participant)/i.test(
            key,
          )
            ? "[REDACTED]"
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
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const body = value as JsonObject;
    const candidate = body.message ?? body.error ?? body.detail;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new RespondentApiError("provider_validation_error", message, 400);
  }
}
