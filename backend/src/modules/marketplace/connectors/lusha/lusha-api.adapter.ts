import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type LushaCredentials = { apiKey: string };

export class LushaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class LushaApiAdapter {
  private readonly origin = "https://api.lusha.com";
  private readonly maxResponseBytes = 256 * 1024;
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: LushaCredentials) {
    const usage = await this.getAccountUsage(credentials);
    return {
      apiOrigin: this.origin,
      apiKeyValidated: true,
      planCategory: usage.plan.category,
    };
  }

  async getAccountUsage(credentials: LushaCredentials) {
    const apiKey = this.credential(credentials?.apiKey);
    const response = this.object(
      await this.request("/v3/account/usage", apiKey),
    );
    const credits = this.object(response.credits);
    const plan = this.object(response.plan);
    return {
      credits: {
        total: this.nonNegativeNumber(credits.total, "credits.total"),
        used: this.nonNegativeNumber(credits.used, "credits.used"),
        remaining: this.nonNegativeNumber(
          credits.remaining,
          "credits.remaining",
        ),
      },
      rateLimits: this.boundedValue(response.rateLimits, "rateLimits", 0),
      plan: {
        category: this.boundedString(plan.category, "plan.category", 80),
        renewalType: this.boundedString(
          plan.renewalType,
          "plan.renewalType",
          80,
        ),
        startDate: this.isoTimestamp(plan.startDate, "plan.startDate"),
        endDate: this.isoTimestamp(plan.endDate, "plan.endDate"),
      },
      pricing: this.boundedValue(response.pricing, "pricing", 0),
    };
  }

  private async request(path: "/v3/account/usage", apiKey: string) {
    const endpoint = new URL(path, this.origin);
    let response: Response;
    try {
      response = await this.requester(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "RelayConsole-Lusha/1.0",
          api_key: apiKey,
        },
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
    } catch {
      throw new LushaApiError(
        "provider_unavailable",
        "Lusha could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new LushaApiError(
        this.errorCode(response.status),
        `Lusha returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private credential(value: unknown) {
    const apiKey = typeof value === "string" ? value.trim() : "";
    if (
      apiKey.length < 16 ||
      apiKey.length > 512 ||
      /[\u0000-\u0020\u007f]/.test(apiKey)
    )
      throw new LushaApiError(
        "credential_missing",
        "A valid customer-owned Lusha API key is required",
        401,
      );
    return apiKey;
  }

  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid("Lusha returned an invalid account-usage object");
    return value as JsonObject;
  }

  private nonNegativeNumber(value: unknown, field: string) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw this.invalid(`Lusha returned invalid ${field}`);
    return value;
  }

  private boundedString(value: unknown, field: string, maxLength: number) {
    if (
      typeof value !== "string" ||
      !value.length ||
      value.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(value)
    )
      throw this.invalid(`Lusha returned invalid ${field}`);
    return value;
  }

  private isoTimestamp(value: unknown, field: string) {
    const text = this.boundedString(value, field, 64);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(text))
      throw this.invalid(`Lusha returned invalid ${field}`);
    return text;
  }

  private boundedValue(value: unknown, field: string, depth: number): unknown {
    if (depth > 4) throw this.invalid(`Lusha returned overly deep ${field}`);
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0)
        throw this.invalid(`Lusha returned invalid ${field}`);
      return value;
    }
    if (typeof value === "string") return this.boundedString(value, field, 256);
    if (Array.isArray(value)) {
      if (value.length > 100)
        throw this.invalid(`Lusha returned too many ${field} entries`);
      return value.map((item, index) =>
        this.boundedValue(item, `${field}[${index}]`, depth + 1),
      );
    }
    if (!value || typeof value !== "object")
      throw this.invalid(`Lusha returned invalid ${field}`);
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 100)
      throw this.invalid(`Lusha returned too many ${field} fields`);
    const result: JsonObject = {};
    for (const [key, child] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key))
        throw this.invalid(`Lusha returned an invalid ${field} field`);
      result[key] = this.boundedValue(child, `${field}.${key}`, depth + 1);
    }
    return result;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Lusha response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new LushaApiError(
        "provider_unavailable",
        "Lusha response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Lusha response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("Lusha returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Lusha returned invalid JSON");
      return {};
    }
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 402 || status === 429) return "provider_rate_limited";
    if (status === 403 || status === 451) return "insufficient_scope";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new LushaApiError("provider_validation_error", message, 400);
  }
}
