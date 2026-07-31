import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type RocketReachCredentials = { apiKey: string };

export class RocketReachApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RocketReachApiAdapter {
  private readonly endpoint =
    "https://api.rocketreach.co/api/v2/universal/account/";
  private readonly maxResponseBytes = 128 * 1024;

  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: RocketReachCredentials) {
    const account = await this.getAccountUsage(credentials);
    return {
      apiEndpoint: this.endpoint,
      apiKeyValidated: true,
      accountLabel: account.plan.name,
    };
  }

  async getAccountUsage(credentials: RocketReachCredentials) {
    const root = this.object(
      await this.request(this.credential(credentials?.apiKey)),
      "response",
    );
    return {
      state: this.enumValue(root.state, "state", [
        "anonymous",
        "test_user",
        "registered",
      ]),
      plan: this.plan(root.plan),
      dailyApiCalls:
        root.daily_api_num_calls === null
          ? null
          : this.nonNegativeInteger(
              root.daily_api_num_calls,
              "daily_api_num_calls",
            ),
      dailyApiLimit: this.boundedString(
        root.daily_api_limit,
        "daily_api_limit",
        40,
      ),
      creditUsage: this.creditUsage(root.credit_usage),
      creditUsageByAction: this.array(
        root.credit_usage_by_action,
        "credit_usage_by_action",
        40,
      ).map((value, index) =>
        this.creditAction(value, `credit_usage_by_action[${index}]`),
      ),
      rateLimits: this.array(root.rate_limits, "rate_limits", 100).map(
        (value, index) => this.rateLimit(value, `rate_limits[${index}]`),
      ),
    };
  }

  private async request(apiKey: string) {
    let response: Response;
    try {
      response = await this.requester(this.endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Api-Key": apiKey,
          "User-Agent": "RelayConsole-RocketReach/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
    } catch {
      throw new RocketReachApiError(
        "provider_unavailable",
        "RocketReach could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new RocketReachApiError(
        this.errorCode(response.status),
        `RocketReach returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private credential(value: unknown) {
    const apiKey = typeof value === "string" ? value.trim() : "";
    if (
      apiKey.length < 16 ||
      apiKey.length > 1024 ||
      /[\s\u0000-\u001f\u007f]/.test(apiKey)
    )
      throw new RocketReachApiError(
        "credential_missing",
        "A valid customer-owned RocketReach API key is required",
        401,
      );
    return apiKey;
  }

  private plan(value: unknown) {
    const plan = this.object(value, "plan");
    return {
      name: this.boundedString(plan.name, "plan.name", 64),
      lookupLimit: this.nonNegativeInteger(
        plan.lookup_limit,
        "plan.lookup_limit",
      ),
      exportLimit: this.nonNegativeInteger(
        plan.export_limit,
        "plan.export_limit",
      ),
    };
  }

  private creditUsage(value: unknown) {
    const usage = this.object(value, "credit_usage");
    return {
      allocated: this.nonNegativeInteger(
        usage.credits_allocated,
        "credit_usage.credits_allocated",
      ),
      used: this.nonNegativeInteger(
        usage.credits_used,
        "credit_usage.credits_used",
      ),
      remaining: this.nonNegativeInteger(
        usage.credits_remaining,
        "credit_usage.credits_remaining",
      ),
      lastSynced: this.isoTimestamp(
        usage.last_synced,
        "credit_usage.last_synced",
      ),
    };
  }

  private creditAction(value: unknown, field: string) {
    const action = this.object(value, field);
    return {
      action: this.boundedString(
        action.credit_action,
        `${field}.credit_action`,
        64,
      ),
      attempted: this.nonNegativeInteger(
        action.attempted_count,
        `${field}.attempted_count`,
      ),
      succeeded: this.nonNegativeInteger(
        action.succeeded_count,
        `${field}.succeeded_count`,
      ),
      creditsUsed: this.nonNegativeInteger(
        action.credits_used,
        `${field}.credits_used`,
      ),
      lastSynced: this.isoTimestamp(action.last_synced, `${field}.last_synced`),
    };
  }

  private rateLimit(value: unknown, field: string) {
    const rateLimit = this.object(value, field);
    return {
      action: this.boundedString(rateLimit.action, `${field}.action`, 64),
      duration: this.boundedString(rateLimit.duration, `${field}.duration`, 64),
      limit:
        rateLimit.limit === null
          ? null
          : this.nonNegativeInteger(rateLimit.limit, `${field}.limit`),
      used: this.nonNegativeInteger(rateLimit.used, `${field}.used`),
      remaining:
        rateLimit.remaining === null
          ? null
          : this.nonNegativeInteger(rateLimit.remaining, `${field}.remaining`),
    };
  }

  private object(value: unknown, field: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid(`RocketReach returned invalid ${field}`);
    return value as JsonObject;
  }

  private array(value: unknown, field: string, maxLength: number) {
    if (!Array.isArray(value) || value.length > maxLength)
      throw this.invalid(`RocketReach returned invalid ${field}`);
    return value;
  }

  private boundedString(value: unknown, field: string, maxLength: number) {
    if (
      typeof value !== "string" ||
      !value.length ||
      value.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(value)
    )
      throw this.invalid(`RocketReach returned invalid ${field}`);
    return value;
  }

  private enumValue(value: unknown, field: string, values: string[]) {
    const text = this.boundedString(value, field, 40);
    if (!values.includes(text))
      throw this.invalid(`RocketReach returned invalid ${field}`);
    return text;
  }

  private nonNegativeInteger(value: unknown, field: string) {
    if (!Number.isSafeInteger(value) || (value as number) < 0)
      throw this.invalid(`RocketReach returned invalid ${field}`);
    return value as number;
  }

  private isoTimestamp(value: unknown, field: string) {
    const text = this.boundedString(value, field, 64);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(text))
      throw this.invalid(`RocketReach returned invalid ${field}`);
    return text;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("RocketReach response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new RocketReachApiError(
        "provider_unavailable",
        "RocketReach response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("RocketReach response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("RocketReach returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("RocketReach returned invalid JSON");
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
    return new RocketReachApiError("provider_validation_error", message, 400);
  }
}
