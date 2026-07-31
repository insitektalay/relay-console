import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SprigCredentials = { apiKey: string };
export type SprigOperationInput = { limit?: unknown };
export const SPRIG_READ_OPERATIONS = ["studies.list"] as const;

export class SprigApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SprigApiAdapter {
  health(credentials: SprigCredentials) {
    return this.read(credentials, "studies.list", { limit: 1 });
  }

  read(
    credentials: SprigCredentials,
    operation: string,
    input: SprigOperationInput,
  ) {
    this.requireCredentials(credentials);
    if (
      !SPRIG_READ_OPERATIONS.includes(operation as never) ||
      Object.keys(input).some((key) => key !== "limit")
    )
      throw new SprigApiError(
        "policy_blocked",
        "Sprig accepts only Relay's pinned study-index operation.",
        403,
      );
    return this.request(credentials, this.integer(input.limit, 1, 25, 20));
  }

  private async request(credentials: SprigCredentials, limit: number) {
    const root = new URL("https://api.sprig.com/v1/");
    const url = new URL("surveys", root);
    url.searchParams.set("limit", String(limit));
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new SprigApiError(
        "policy_blocked",
        "Sprig requests must stay on the HTTPS Data Export API route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new SprigApiError(
        "provider_unavailable",
        "Sprig could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Sprig response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new SprigApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Sprig returned HTTP ${response.status}.`,
        response.status,
      );
    return this.minimize(data);
  }

  private minimize(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const fields = [
      "id",
      "name",
      "status",
      "platform",
      "type",
      "createdAt",
      "updatedAt",
      "launchedAt",
      "completedAt",
    ];
    return {
      data: Array.isArray(body.data)
        ? body.data.slice(0, 25).map((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry))
              return null;
            const item = entry as JsonObject;
            return Object.fromEntries(
              fields
                .filter((field) => item[field] !== undefined)
                .map((field) => [field, item[field]]),
            );
          })
        : [],
    };
  }

  private requireCredentials(credentials: SprigCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new SprigApiError(
        "credential_missing",
        "A valid Sprig API key is required.",
        401,
      );
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max)
      throw this.invalid(`limit must be an integer from ${min} to ${max}.`);
    return number;
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
          /(token|secret|authorization|password|cookie|credential|api.?key|email|visitor|external.?user|response|transcript|download.?url|video.?url|metadata)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "credential_missing";
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
    return new SprigApiError("provider_validation_error", message, 400);
  }
}
