import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type LeadIqCredentials = { apiKey: string };

export class LeadIqApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class LeadIqApiAdapter {
  private readonly endpoint = "https://api.leadiq.com/graphql";
  private readonly maxResponseBytes = 128 * 1024;
  private readonly accountQuery =
    "query RelayAccount { account { plans { name product status nextBillingPeriod } dataHubPlan { name product status nextBillingPeriod available used } universalPlan { name product status nextBillingPeriod available used } } }";

  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: LeadIqCredentials) {
    const account = await this.getAccountUsage(credentials);
    return {
      apiEndpoint: this.endpoint,
      apiKeyValidated: true,
      accountLabel: account.plans[0]?.name ?? "account",
    };
  }

  async getAccountUsage(credentials: LeadIqCredentials) {
    const apiKey = this.credential(credentials?.apiKey);
    const root = this.object(await this.request(apiKey), "response");
    if (Array.isArray(root.errors) && root.errors.length)
      throw this.invalid("LeadIQ returned GraphQL errors");
    const data = this.object(root.data, "data");
    const account = this.object(data.account, "data.account");
    const plans = this.array(account.plans, "plans", 20).map((value, index) =>
      this.plan(value, `plans[${index}]`, false),
    );
    return {
      plans,
      dataHubPlan:
        account.dataHubPlan === null
          ? null
          : this.plan(account.dataHubPlan, "dataHubPlan", true),
      universalPlan:
        account.universalPlan === null
          ? null
          : this.plan(account.universalPlan, "universalPlan", true),
    };
  }

  private async request(apiKey: string) {
    let response: Response;
    try {
      response = await this.requester(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole-LeadIQ/1.0",
        },
        body: JSON.stringify({ query: this.accountQuery }),
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
    } catch {
      throw new LeadIqApiError(
        "provider_unavailable",
        "LeadIQ could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new LeadIqApiError(
        this.errorCode(response.status),
        `LeadIQ returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private credential(value: unknown) {
    const apiKey = typeof value === "string" ? value.trim() : "";
    if (
      apiKey.length < 16 ||
      apiKey.length > 1024 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(apiKey)
    )
      throw new LeadIqApiError(
        "credential_missing",
        "A valid customer-owned Base64 LeadIQ API key is required",
        401,
      );
    return apiKey;
  }

  private plan(value: unknown, field: string, withCredits: boolean) {
    const plan = this.object(value, field);
    const result: JsonObject = {
      name: this.boundedString(plan.name, `${field}.name`, 120),
      product: this.enumValue(plan.product, `${field}.product`, [
        "DataHub",
        "ContactTracking",
        "Api",
        "Universal",
      ]),
      status: this.enumValue(plan.status, `${field}.status`, [
        "Active",
        "Inactive",
        "Trialing",
      ]),
      nextBillingPeriod:
        plan.nextBillingPeriod === null
          ? null
          : this.isoTimestamp(
              plan.nextBillingPeriod,
              `${field}.nextBillingPeriod`,
            ),
    };
    if (withCredits) {
      result.available = this.nonNegativeInteger(
        plan.available,
        `${field}.available`,
      );
      result.used = this.nonNegativeInteger(plan.used, `${field}.used`);
    }
    return result;
  }

  private object(value: unknown, field: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid(`LeadIQ returned invalid ${field}`);
    return value as JsonObject;
  }

  private array(value: unknown, field: string, maxLength: number) {
    if (!Array.isArray(value) || value.length > maxLength)
      throw this.invalid(`LeadIQ returned invalid ${field}`);
    return value;
  }

  private boundedString(value: unknown, field: string, maxLength: number) {
    if (
      typeof value !== "string" ||
      !value.length ||
      value.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(value)
    )
      throw this.invalid(`LeadIQ returned invalid ${field}`);
    return value;
  }

  private enumValue(value: unknown, field: string, values: string[]) {
    const text = this.boundedString(value, field, 40);
    if (!values.includes(text))
      throw this.invalid(`LeadIQ returned invalid ${field}`);
    return text;
  }

  private nonNegativeInteger(value: unknown, field: string) {
    if (!Number.isSafeInteger(value) || (value as number) < 0)
      throw this.invalid(`LeadIQ returned invalid ${field}`);
    return value as number;
  }

  private isoTimestamp(value: unknown, field: string) {
    const text = this.boundedString(value, field, 64);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(text))
      throw this.invalid(`LeadIQ returned invalid ${field}`);
    return text;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("LeadIQ response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new LeadIqApiError(
        "provider_unavailable",
        "LeadIQ response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("LeadIQ response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("LeadIQ returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("LeadIQ returned invalid JSON");
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
    return new LeadIqApiError("provider_validation_error", message, 400);
  }
}
