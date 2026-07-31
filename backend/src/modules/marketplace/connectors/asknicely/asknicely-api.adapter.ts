import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type AskNicelyCredentials = { subdomain: string; apiKey: string };
export type AskNicelyOperationInput = {
  page?: unknown;
  limit?: unknown;
  since?: unknown;
  days?: unknown;
  year?: unknown;
  month?: unknown;
  day?: unknown;
};
export const ASKNICELY_READ_OPERATIONS = [
  "responses.list",
  "nps.get",
  "sent-stats.get",
  "historical-stats.get",
] as const;

export class AskNicelyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AskNicelyApiAdapter {
  health(credentials: AskNicelyCredentials) {
    return this.request(credentials, "getnps/30");
  }

  read(
    credentials: AskNicelyCredentials,
    operation: string,
    input: AskNicelyOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!ASKNICELY_READ_OPERATIONS.includes(operation as never))
      throw this.invalid(
        "AskNicely operation is not in Relay's pinned read-only contract.",
      );
    if (operation === "responses.list") {
      this.requireOnly(input, ["page", "limit", "since"]);
      const limit = this.integer(input.limit, "limit", 1, 25, 20);
      const page = this.integer(input.page, "page", 1, 10_000, 1);
      const since = this.integer(input.since, "since", 0, 4_102_444_800, 0);
      return this.request(
        credentials,
        `responses/desc/${limit}/${page}/${since}/json`,
        true,
      );
    }
    if (operation === "nps.get" || operation === "sent-stats.get") {
      this.requireOnly(input, ["days"]);
      const days = this.integer(input.days, "days", 1, 3650, 30);
      return this.request(
        credentials,
        `${operation === "nps.get" ? "getnps" : "sentstats"}/${days}`,
      );
    }
    this.requireOnly(input, ["year", "month", "day"]);
    const year = this.integer(
      input.year,
      "year",
      2000,
      2100,
      new Date().getUTCFullYear(),
    );
    const month = this.integer(input.month, "month", 1, 12, 1);
    const day = this.integer(input.day, "day", 1, 31, 1);
    return this.request(
      credentials,
      `stats?year=${year}&month=${month}&day=${day}`,
    );
  }

  private async request(
    credentials: AskNicelyCredentials,
    target: string,
    responseList = false,
  ) {
    this.requireCredentials(credentials);
    const origin = `https://${credentials.subdomain}.asknice.ly`;
    const root = new URL("/api/v1/", origin);
    const url = new URL(target, root);
    if (url.origin !== origin || !url.pathname.startsWith(root.pathname))
      throw new AskNicelyApiError(
        "policy_blocked",
        "AskNicely requests must stay on the configured tenant's HTTPS API v1 route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-apikey": credentials.apiKey,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AskNicelyApiError(
        "provider_unavailable",
        "The configured AskNicely tenant could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("AskNicely response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new AskNicelyApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `AskNicely returned HTTP ${response.status}.`,
        response.status,
      );
    return responseList ? this.responseList(data) : data;
  }

  private responseList(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const responses = Array.isArray(body.data)
      ? body.data.slice(0, 25)
      : Array.isArray(body.responses)
        ? body.responses.slice(0, 25)
        : [];
    return {
      success: body.success,
      responses,
      page: body.pagenumber ?? body.page,
      pageSize: body.pagesize,
      totalPages: body.pages,
    };
  }

  private requireCredentials(credentials: AskNicelyCredentials) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(credentials.subdomain))
      throw new AskNicelyApiError(
        "credential_missing",
        "A valid AskNicely tenant subdomain is required.",
        401,
      );
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new AskNicelyApiError(
        "credential_missing",
        "A valid AskNicely API key is required.",
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

  private requireOnly(
    input: AskNicelyOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "AskNicely input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: AskNicelyOperationInput) {
    const allowed = new Set([
      "page",
      "limit",
      "since",
      "days",
      "year",
      "month",
      "day",
    ]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new AskNicelyApiError(
        "policy_blocked",
        "AskNicely accepts only pinned operation inputs.",
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
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url|download_url)/i.test(
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
    const candidate = body.message ?? body.error ?? body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new AskNicelyApiError("provider_validation_error", message, 400);
  }
}
