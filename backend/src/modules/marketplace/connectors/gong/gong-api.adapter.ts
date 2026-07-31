import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export const GONG_READ_OPERATIONS = ["calls.list"] as const;
export type GongCallRangeInput = {
  fromDateTime?: unknown;
  toDateTime?: unknown;
};

const CALL_FIELDS = [
  "id",
  "title",
  "scheduled",
  "started",
  "duration",
  "direction",
  "scope",
  "media",
  "language",
  "isPrivate",
] as const;

export class GongApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GongApiAdapter {
  read(
    accessToken: string,
    apiBaseUrl: string,
    operation: string,
    input: GongCallRangeInput,
  ) {
    if (!GONG_READ_OPERATIONS.includes(operation as never))
      throw new GongApiError(
        "policy_blocked",
        "Gong operation is not in Relay's pinned basic-metadata contract.",
        403,
      );
    const range = this.range(input);
    return this.request(accessToken, apiBaseUrl, range);
  }

  private async request(
    accessToken: string,
    apiBaseUrl: string,
    range: { fromDateTime: string; toDateTime: string },
  ) {
    this.requireToken(accessToken);
    const root = this.base(apiBaseUrl);
    const url = new URL("/v2/calls", root);
    url.searchParams.set("fromDateTime", range.fromDateTime);
    url.searchParams.set("toDateTime", range.toDateTime);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new GongApiError(
        "provider_unavailable",
        "Gong could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Gong response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new GongApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Gong returned HTTP ${response.status}.`,
        response.status,
      );
    return this.summaries(data);
  }

  private summaries(value: unknown) {
    const body = this.object(value);
    const calls = Array.isArray(body.calls) ? body.calls.slice(0, 25) : [];
    const records = this.object(body.records);
    return {
      data: calls.map((item) => {
        const record = this.object(item);
        return Object.fromEntries(
          CALL_FIELDS.filter((key) => record[key] !== undefined).map((key) => [
            key,
            record[key],
          ]),
        );
      }),
      hasNextPage:
        typeof records.cursor === "string" && records.cursor.length > 0,
    };
  }

  private range(input: GongCallRangeInput) {
    const keys = Object.keys(input);
    if (keys.some((key) => !["fromDateTime", "toDateTime"].includes(key)))
      throw new GongApiError(
        "policy_blocked",
        "Gong filters and cursors are not exposed by Relay.",
        403,
      );
    const fromDateTime = this.date(input.fromDateTime, "fromDateTime");
    const toDateTime = this.date(input.toDateTime, "toDateTime");
    const from = Date.parse(fromDateTime);
    const to = Date.parse(toDateTime);
    if (to <= from || to - from > 31 * 24 * 60 * 60 * 1_000)
      throw this.invalid(
        "Gong date range must be positive and at most 31 days.",
      );
    return { fromDateTime, toDateTime };
  }

  private date(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      value.length > 64 ||
      !value.includes("T") ||
      !Number.isFinite(Date.parse(value))
    )
      throw this.invalid(`${field} must be a valid ISO-8601 date-time.`);
    return value;
  }

  private base(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Gong API base URL is invalid.");
    }
    const allowedHost =
      url.hostname === "api.gong.io" || url.hostname.endsWith(".api.gong.io");
    if (
      url.protocol !== "https:" ||
      !allowedHost ||
      url.port ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    )
      throw new GongApiError(
        "policy_blocked",
        "Gong API base URL must be an HTTPS gong.io API hostname.",
        403,
      );
    return url;
  }

  private requireToken(accessToken: string) {
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new GongApiError(
        "credential_missing",
        "A valid Gong OAuth access token is required.",
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
      return value.slice(0, 100).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 500_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie|email|phone|address|participant|transcript|content|body|meeting.?url|custom.?data)/i.test(
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
    if (typeof body.message === "string") return body.message.slice(0, 500);
    if (Array.isArray(body.errors) && typeof body.errors[0] === "string")
      return body.errors[0].slice(0, 500);
    return null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new GongApiError("provider_validation_error", message, 400);
  }
}
