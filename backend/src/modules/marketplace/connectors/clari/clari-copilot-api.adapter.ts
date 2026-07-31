import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ClariCopilotCredentials = { apiKey: string; apiPassword: string };
export type ClariCopilotRangeInput = {
  fromDateTime?: unknown;
  toDateTime?: unknown;
};
export const CLARI_READ_OPERATIONS = ["calls.list"] as const;

const CALL_FIELDS = [
  "id",
  "title",
  "status",
  "type",
  "time",
  "duration",
  "processed_at",
  "language",
] as const;

export class ClariCopilotApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ClariCopilotApiAdapter {
  read(
    credentials: ClariCopilotCredentials,
    operation: string,
    input: ClariCopilotRangeInput,
  ) {
    if (!CLARI_READ_OPERATIONS.includes(operation as never))
      throw new ClariCopilotApiError(
        "policy_blocked",
        "Clari operation is not in Relay's pinned call-metadata contract.",
        403,
      );
    return this.request(credentials, this.range(input));
  }

  private async request(
    credentials: ClariCopilotCredentials,
    range: { fromDateTime: string; toDateTime: string },
  ) {
    this.requireCredentials(credentials);
    const url = new URL("https://rest-api.copilot.clari.com/calls");
    url.searchParams.set("skip", "0");
    url.searchParams.set("limit", "25");
    url.searchParams.set("filterTimeGt", range.fromDateTime);
    url.searchParams.set("filterTimeLt", range.toDateTime);
    url.searchParams.set("sortTime", "desc");
    url.searchParams.set("includePrivate", "false");
    url.searchParams.set("includeAudio", "false");
    url.searchParams.set("includeVideo", "false");
    url.searchParams.set("includePagination", "false");
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": credentials.apiKey,
          "X-Api-Password": credentials.apiPassword,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ClariCopilotApiError(
        "provider_unavailable",
        "Clari Copilot could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid(
        "Clari Copilot response exceeds Relay's 2.5 MB limit.",
      );
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new ClariCopilotApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Clari Copilot returned HTTP ${response.status}.`,
        response.status,
      );
    return this.summaries(data);
  }

  private summaries(value: unknown) {
    const body = this.object(value);
    const calls = Array.isArray(body.calls) ? body.calls.slice(0, 25) : [];
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
      hasNextPage: false,
    };
  }

  private range(input: ClariCopilotRangeInput) {
    if (
      Object.keys(input).some(
        (key) => !["fromDateTime", "toDateTime"].includes(key),
      )
    )
      throw new ClariCopilotApiError(
        "policy_blocked",
        "Clari participant, topic, status, source, and paging filters are not exposed by Relay.",
        403,
      );
    const fromDateTime = this.date(input.fromDateTime, "fromDateTime");
    const toDateTime = this.date(input.toDateTime, "toDateTime");
    const from = Date.parse(fromDateTime);
    const to = Date.parse(toDateTime);
    if (to <= from || to - from > 31 * 24 * 60 * 60 * 1_000)
      throw this.invalid(
        "Clari date range must be positive and at most 31 days.",
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

  private requireCredentials(credentials: ClariCopilotCredentials) {
    for (const value of [credentials.apiKey, credentials.apiPassword])
      if (!value || value.length > 16_000 || /[\r\n]/.test(value))
        throw new ClariCopilotApiError(
          "credential_missing",
          "Valid Clari Copilot API credentials are required.",
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
          /(token|secret|password|credential|authorization|api.?key|cookie|email|phone|address|participant|user|transcript|speaker|summary|audio|video|media|topic|content|body|external.?url|meeting.?url|custom.?data)/i.test(
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
    const candidate = body.message ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new ClariCopilotApiError("provider_validation_error", message, 400);
  }
}
