import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type CognismCredentials = { apiKey: string };
export type CognismSearchInput = { query?: unknown; matchType?: unknown };
export const COGNISM_READ_OPERATIONS = ["accounts.search"] as const;

export class CognismApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class CognismApiAdapter {
  health(credentials: CognismCredentials) {
    return this.request(
      credentials,
      "GET",
      "/api/search/entitlement/accountEntitlementSubscription",
    );
  }

  read(
    credentials: CognismCredentials,
    operation: string,
    input: CognismSearchInput,
  ) {
    this.rejectUnknownInput(input);
    if (!COGNISM_READ_OPERATIONS.includes(operation as never))
      throw new CognismApiError(
        "policy_blocked",
        "Cognism operation is not in Relay's pinned account-preview contract.",
        403,
      );
    const matchType = this.matchType(input.matchType);
    const query = this.query(input.query, matchType);
    return this.request(
      credentials,
      "POST",
      "/api/search/account/search?indexSize=20&lastReturnedKey=",
      matchType === "domain"
        ? {
            domains: [query],
            accountSearchOptions: {
              match_exact_account_name: true,
              match_exact_domain: true,
              show_max_events: 0,
            },
          }
        : {
            names: [query],
            accountSearchOptions: {
              match_exact_account_name: true,
              match_exact_domain: true,
              show_max_events: 0,
            },
          },
    );
  }

  private async request(
    credentials: CognismCredentials,
    method: "GET" | "POST",
    path: string,
    body?: JsonObject,
  ) {
    this.requireCredentials(credentials);
    const root = new URL("https://app.cognism.com/");
    const url = new URL(path, root);
    if (url.origin !== root.origin || !url.pathname.startsWith("/api/search/"))
      throw new CognismApiError(
        "policy_blocked",
        "Cognism requests must stay on the pinned HTTPS search API.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new CognismApiError(
        "provider_unavailable",
        "Cognism could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Cognism response exceeds Relay's 2.5 MB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new CognismApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Cognism returned HTTP ${response.status}.`,
        response.status,
      );
    return method === "POST" ? this.accountPreviews(data) : { entitled: true };
  }

  private accountPreviews(value: unknown) {
    const body = this.object(value);
    const source = Array.isArray(body.results)
      ? body.results
      : Array.isArray(body.result)
        ? body.result
        : [];
    return {
      totalResults: this.integerOrNull(body.totalResults ?? body.total),
      results: source.slice(0, 20).map((item) => this.accountPreview(item)),
      hasMore: false,
    };
  }

  private accountPreview(value: unknown) {
    const account = this.object(value);
    return Object.fromEntries(
      [
        "id",
        "name",
        "domain",
        "industry",
        "description",
        "shortDescription",
        "founded",
        "website",
        "revenue",
        "size",
        "headcount",
        "type",
        "country",
        "city",
      ]
        .filter((key) => account[key] !== undefined)
        .map((key) => [key, this.bound(account[key])]),
    );
  }

  private query(value: unknown, matchType: "name" | "domain") {
    if (typeof value !== "string")
      throw this.invalid("Cognism query must be a string.");
    const query = value.trim();
    if (query.length < 2 || query.length > 160 || /[\r\n]/.test(query))
      throw this.invalid(
        "Cognism query must contain 2 to 160 single-line characters.",
      );
    if (
      matchType === "domain" &&
      (query.length > 253 ||
        !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
          query,
        ))
    )
      throw this.invalid("Cognism domain must be a plain DNS hostname.");
    return matchType === "domain" ? query.toLowerCase() : query;
  }

  private matchType(value: unknown): "name" | "domain" {
    if (value === undefined) return "name";
    if (value !== "name" && value !== "domain")
      throw this.invalid("Cognism matchType must be name or domain.");
    return value;
  }

  private rejectUnknownInput(input: CognismSearchInput) {
    const allowed = new Set(["query", "matchType"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new CognismApiError(
        "policy_blocked",
        "Cognism accepts only the pinned account-preview inputs.",
        403,
      );
  }

  private requireCredentials(credentials: CognismCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new CognismApiError(
        "credential_missing",
        "A valid Cognism API key is required.",
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

  private bound(value: unknown, depth = 0): unknown {
    if (depth > 5) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 2_000);
    if (Array.isArray(value))
      return value.slice(0, 20).map((item) => this.bound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          /(email|phone|contact|person|linkedin|social|location|street|address|event|technology|token|secret|password|credential|authorization|api.?key|cookie)/i.test(
            key,
          )
            ? "[redacted]"
            : this.bound(item, depth + 1),
        ]),
    );
  }

  private integerOrNull(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 402) return "insufficient_scope";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    const body = this.object(value);
    const first = Array.isArray(body.errors) ? this.object(body.errors[0]) : {};
    const candidate = body.message ?? first.message ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new CognismApiError("provider_validation_error", message, 400);
  }
}
