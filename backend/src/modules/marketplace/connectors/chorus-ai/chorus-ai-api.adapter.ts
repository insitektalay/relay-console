import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ChorusAiCredentials = { apiToken: string };
export type ChorusAiRangeInput = {
  minDate?: unknown;
  maxDate?: unknown;
};
export const CHORUS_AI_READ_OPERATIONS = ["engagements.list"] as const;

const ENGAGEMENT_FIELDS = [
  "id",
  "engagement_id",
  "name",
  "title",
  "start_time",
  "end_time",
  "duration",
  "status",
  "source",
  "disposition",
  "language",
  "private",
  "engagement_type",
  "content_type",
  "compliance",
] as const;

export class ChorusAiApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ChorusAiApiAdapter {
  read(
    credentials: ChorusAiCredentials,
    operation: string,
    input: ChorusAiRangeInput,
  ) {
    if (!CHORUS_AI_READ_OPERATIONS.includes(operation as never))
      throw new ChorusAiApiError(
        "policy_blocked",
        "Chorus.ai operation is not in Relay's pinned metadata-only contract.",
        403,
      );
    return this.request(credentials, this.range(input));
  }

  private async request(
    credentials: ChorusAiCredentials,
    range: { minDate: string; maxDate: string },
  ) {
    this.requireToken(credentials.apiToken);
    const url = new URL("https://chorus.ai/v3/engagements");
    url.searchParams.set("min_date", range.minDate);
    url.searchParams.set("max_date", range.maxDate);
    url.searchParams.set("with_trackers", "false");
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: credentials.apiToken,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ChorusAiApiError(
        "provider_unavailable",
        "Chorus.ai could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Chorus.ai response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new ChorusAiApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Chorus.ai returned HTTP ${response.status}.`,
        response.status,
      );
    return this.summaries(data);
  }

  private summaries(value: unknown) {
    const body = this.object(value);
    const source = Array.isArray(body.engagements)
      ? body.engagements
      : Array.isArray(body.data)
        ? body.data
        : [];
    const rows = source.slice(0, 25);
    return {
      data: rows.map((item) => {
        const record = this.object(item);
        return Object.fromEntries(
          ENGAGEMENT_FIELDS.filter((key) => record[key] !== undefined).map(
            (key) => [key, record[key]],
          ),
        );
      }),
      hasNextPage:
        typeof body.continuation_key === "string" &&
        body.continuation_key.length > 0,
    };
  }

  private range(input: ChorusAiRangeInput) {
    if (Object.keys(input).some((key) => !["minDate", "maxDate"].includes(key)))
      throw new ChorusAiApiError(
        "policy_blocked",
        "Chorus.ai filters and continuation keys are not exposed by Relay.",
        403,
      );
    const minDate = this.date(input.minDate, "minDate");
    const maxDate = this.date(input.maxDate, "maxDate");
    const min = Date.parse(minDate);
    const max = Date.parse(maxDate);
    if (max <= min || max - min > 31 * 24 * 60 * 60 * 1_000)
      throw this.invalid(
        "Chorus.ai date range must be positive and at most 31 days.",
      );
    return { minDate, maxDate };
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

  private requireToken(token: string) {
    if (!token || token.length > 16_000 || /[\r\n]/.test(token))
      throw new ChorusAiApiError(
        "credential_missing",
        "A valid Chorus.ai API token is required.",
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
          /(token|secret|password|credential|authorization|api.?key|cookie|email|phone|address|participant|owner|transcript|utterance|recording|media|tracker|content|body|external.?url|meeting.?url|custom.?data)/i.test(
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
    return new ChorusAiApiError("provider_validation_error", message, 400);
  }
}
