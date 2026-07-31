import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type OsanoCredentials = { apiKey: string };
export const OSANO_OPERATIONS = ["cookieConsentConfigs.list"] as const;

export class OsanoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class OsanoApiAdapter {
  async health(credentials: OsanoCredentials) {
    const result = await this.read(credentials, {
      operation: "cookieConsentConfigs.list",
      limit: 1,
    });
    return {
      cookieConsentDirectoryVerified: true,
      visibleCountAtLeast: result.items.length,
    };
  }

  async read(credentials: OsanoCredentials, input: JsonObject) {
    if (input.operation !== "cookieConsentConfigs.list")
      throw new OsanoApiError(
        "policy_blocked",
        "Osano operation is outside Relay's pinned cookie-consent configuration directory.",
        403,
      );
    const limit = this.integer(input.limit, 1, 20, 20);
    const url = new URL("https://api.osano.com/v1/cookie-consent/configs");
    url.searchParams.set("limit", String(limit));
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-osano-api-key": this.key(credentials.apiKey),
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new OsanoApiError(
        "provider_unavailable",
        "Osano API could not be reached.",
        502,
      );
    }
    const body = await this.body(response);
    if (!response.ok)
      throw new OsanoApiError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status >= 500
            ? "provider_unavailable"
            : response.status === 401 || response.status === 403
              ? "credential_missing"
              : "provider_validation_error",
        this.message(body) ?? `Osano returned HTTP ${response.status}.`,
        response.status || 400,
      );
    if (!Array.isArray(body.items))
      throw new OsanoApiError(
        "provider_validation_error",
        "Osano returned an invalid configuration directory.",
        502,
      );
    return {
      items: body.items
        .slice(0, limit)
        .map((entry) => this.object(entry))
        .map((item) => ({
          id: this.id(item.configId ?? item.id),
          name: this.string(item.name, 250),
          mode: this.string(item.mode, 40),
          createdAt: this.string(item.created ?? item.createdAt, 80),
          updatedAt: this.string(item.updated ?? item.updatedAt, 80),
        }))
        .filter((item) => item.id),
      next: this.string(body.next, 2_000),
      limit,
    };
  }

  private async body(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 500_000)
      throw new OsanoApiError(
        "provider_validation_error",
        "Osano response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }
  private key(value: string) {
    if (!value || value.length > 2_000 || /[\r\n]/.test(value))
      throw new OsanoApiError(
        "credential_missing",
        "A valid Osano API key is required.",
        401,
      );
    return value;
  }
  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new OsanoApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }
  private id(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value)
      ? value
      : null;
  }
  private string(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private message(body: JsonObject) {
    return this.string(body.message ?? body.error, 500);
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
