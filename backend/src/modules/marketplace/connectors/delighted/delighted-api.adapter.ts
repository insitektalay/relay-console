import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type DelightedCredentials = { apiKey: string };
export type DelightedOperationInput = {
  page?: unknown;
  limit?: unknown;
  since?: unknown;
  until?: unknown;
  order?: unknown;
};
export const DELIGHTED_READ_OPERATIONS = [
  "responses.list",
  "metrics.get",
] as const;

export class DelightedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DelightedApiAdapter {
  health(credentials: DelightedCredentials) {
    return this.request(credentials, "metrics.json", {});
  }

  read(
    credentials: DelightedCredentials,
    operation: string,
    input: DelightedOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!DELIGHTED_READ_OPERATIONS.includes(operation as never))
      throw this.invalid(
        "Delighted operation is not in Relay's pinned read-only contract.",
      );
    if (operation === "responses.list") {
      this.requireOnly(input, ["page", "limit", "since", "until", "order"]);
      const order = input.order === undefined ? "desc" : input.order;
      if (
        !["asc", "desc", "asc:updated_at", "desc:updated_at"].includes(
          String(order),
        )
      )
        throw this.invalid("order is not supported.");
      return this.request(credentials, "survey_responses.json", {
        per_page: this.integer(input.limit, "limit", 1, 25, 20),
        page: this.integer(input.page, "page", 1, 10_000, 1),
        order: String(order),
        ...this.timeRange(input),
      });
    }
    this.requireOnly(input, ["since", "until"]);
    return this.request(credentials, "metrics.json", {
      ...this.timeRange(input),
      "groups[]": "core",
    });
  }

  private timeRange(input: DelightedOperationInput) {
    const since =
      input.since === undefined
        ? undefined
        : this.integer(input.since, "since", 0, 4_102_444_800, 0);
    const until =
      input.until === undefined
        ? undefined
        : this.integer(input.until, "until", 0, 4_102_444_800, 0);
    if (since !== undefined && until !== undefined && since > until)
      throw this.invalid("since cannot be later than until.");
    return {
      ...(since === undefined ? {} : { since }),
      ...(until === undefined ? {} : { until }),
    };
  }

  private async request(
    credentials: DelightedCredentials,
    target: string,
    query: Record<string, string | number>,
  ) {
    this.requireCredentials(credentials);
    const root = new URL("https://api.delighted.com/v1/");
    const url = new URL(target, root);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new DelightedApiError(
        "policy_blocked",
        "Delighted requests must stay on the HTTPS API v1 route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:`).toString("base64")}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DelightedApiError(
        "provider_unavailable",
        "Delighted could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Delighted response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new DelightedApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Delighted returned HTTP ${response.status}.`,
        response.status,
      );
    return target === "survey_responses.json" ? this.responseList(data) : data;
  }

  private responseList(value: unknown) {
    if (!Array.isArray(value)) return value;
    return value.slice(0, 25).map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const response = item as JsonObject;
      return Object.fromEntries(
        [
          "id",
          "person",
          "survey_type",
          "score",
          "comment",
          "created_at",
          "updated_at",
          "tags",
        ]
          .filter((key) => response[key] !== undefined)
          .map((key) => [key, response[key]]),
      );
    });
  }

  private requireCredentials(credentials: DelightedCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n:]/.test(credentials.apiKey)
    )
      throw new DelightedApiError(
        "credential_missing",
        "A valid Delighted API key is required.",
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
    input: DelightedOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "Delighted input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: DelightedOperationInput) {
    const allowed = new Set(["page", "limit", "since", "until", "order"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new DelightedApiError(
        "policy_blocked",
        "Delighted accepts only pinned operation inputs.",
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
          /(token|secret|authorization|password|cookie|credential|api.?key|permalink|signed.?url)/i.test(
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
    return new DelightedApiError("provider_validation_error", message, 400);
  }
}
