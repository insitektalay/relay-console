import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type RewardfulCredentials = { apiSecret: string };
export type RewardfulOperationInput = {
  page?: unknown;
  limit?: unknown;
  affiliateId?: unknown;
  state?: unknown;
};

export const REWARDFUL_READ_OPERATIONS = [
  "campaigns.list",
  "affiliates.list",
  "referrals.list",
  "commissions.list",
  "payouts.list",
] as const;

type RewardfulResource =
  | "campaigns"
  | "affiliates"
  | "referrals"
  | "commissions"
  | "payouts";

const SUMMARY_FIELDS: Record<RewardfulResource, readonly string[]> = {
  campaigns: [
    "id",
    "created_at",
    "updated_at",
    "name",
    "private",
    "reward_type",
    "commission_percent",
    "commission_amount_cents",
    "commission_amount_currency",
    "minimum_payout_cents",
    "minimum_payout_currency",
    "days_before_referrals_expire",
    "days_until_commissions_are_due",
    "default",
    "visitors",
    "leads",
    "conversions",
    "affiliates",
  ],
  affiliates: [
    "id",
    "created_at",
    "updated_at",
    "state",
    "visitors",
    "leads",
    "conversions",
    "campaign",
  ],
  referrals: [
    "id",
    "created_at",
    "updated_at",
    "conversion_state",
    "deactivated_at",
    "expires_at",
    "visits",
    "affiliate_id",
  ],
  commissions: [
    "id",
    "created_at",
    "updated_at",
    "amount",
    "currency",
    "state",
    "due_at",
    "paid_at",
    "voided_at",
    "campaign",
  ],
  payouts: [
    "id",
    "created_at",
    "updated_at",
    "amount",
    "currency",
    "state",
    "due_at",
    "paid_at",
    "affiliate_id",
  ],
};

export class RewardfulApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RewardfulApiAdapter {
  health(credentials: RewardfulCredentials) {
    return this.request(credentials, "campaigns", {});
  }

  read(
    credentials: RewardfulCredentials,
    operation: string,
    input: RewardfulOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!REWARDFUL_READ_OPERATIONS.includes(operation as never))
      throw this.invalid(
        "Rewardful operation is not in Relay's pinned read-only contract.",
      );
    const resource = operation.split(".")[0] as RewardfulResource;
    const allowed =
      resource === "campaigns"
        ? []
        : resource === "affiliates"
          ? ["page", "limit"]
          : ["page", "limit", "affiliateId", "state"];
    this.requireOnly(input, allowed);
    const query: Record<string, string | number> = {};
    if (resource !== "campaigns") {
      query.page = this.integer(input.page, "page", 1, 10_000, 1);
      query.limit = this.integer(input.limit, "limit", 1, 25, 20);
    }
    if (input.affiliateId !== undefined)
      query.affiliate_id = this.uuid(input.affiliateId, "affiliateId");
    if (input.state !== undefined)
      query[resource === "referrals" ? "conversion_state" : "state"] =
        this.state(resource, input.state);
    return this.request(credentials, resource, query);
  }

  private async request(
    credentials: RewardfulCredentials,
    resource: RewardfulResource,
    query: Record<string, string | number>,
  ) {
    this.requireCredentials(credentials);
    const root = new URL("https://api.getrewardful.com/v1/");
    const url = new URL(resource, root);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new RewardfulApiError(
        "policy_blocked",
        "Rewardful requests must stay on the HTTPS API v1 route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${credentials.apiSecret}:`).toString("base64")}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new RewardfulApiError(
        "provider_unavailable",
        "Rewardful could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Rewardful response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new RewardfulApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Rewardful returned HTTP ${response.status}.`,
        response.status,
      );
    return this.summaries(resource, data);
  }

  private summaries(resource: RewardfulResource, value: unknown) {
    const summarize = (item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const object = item as JsonObject;
      return Object.fromEntries(
        SUMMARY_FIELDS[resource]
          .filter((key) => object[key] !== undefined)
          .map((key) => [
            key,
            key === "campaign"
              ? this.campaignSummary(object[key])
              : object[key],
          ]),
      );
    };
    if (Array.isArray(value)) return value.slice(0, 25).map(summarize);
    if (!value || typeof value !== "object") return value;
    const body = value as JsonObject;
    const data = Array.isArray(body.data)
      ? body.data.slice(0, 25).map(summarize)
      : [];
    return { pagination: body.pagination, data };
  }

  private campaignSummary(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const campaign = value as JsonObject;
    return Object.fromEntries(
      ["id", "name", "default"]
        .filter((key) => campaign[key] !== undefined)
        .map((key) => [key, campaign[key]]),
    );
  }

  private state(resource: RewardfulResource, value: unknown) {
    const states: Partial<Record<RewardfulResource, readonly string[]>> = {
      referrals: ["visitor", "lead", "conversion", "deactivated"],
      commissions: ["due", "pending", "paid", "voided"],
      payouts: ["pending", "due", "processing", "paid"],
    };
    const state = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!states[resource]?.includes(state))
      throw this.invalid(`state is not supported for Rewardful ${resource}.`);
    return state;
  }

  private uuid(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        text,
      )
    )
      throw this.invalid(`Rewardful ${name} must be a UUID.`);
    return text;
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
    input: RewardfulOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "Rewardful input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: RewardfulOperationInput) {
    const allowed = new Set(["page", "limit", "affiliateId", "state"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new RewardfulApiError(
        "policy_blocked",
        "Rewardful accepts only pinned operation inputs.",
        403,
      );
  }

  private requireCredentials(credentials: RewardfulCredentials) {
    if (
      !credentials.apiSecret ||
      credentials.apiSecret.length > 16_000 ||
      /[\r\n:]/.test(credentials.apiSecret)
    )
      throw new RewardfulApiError(
        "credential_missing",
        "A valid Rewardful API secret is required.",
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
          /(token|secret|authorization|password|cookie|credential|api.?key|email|customer|paypal|wise|stripe|signed.?url)/i.test(
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
    return new RewardfulApiError("provider_validation_error", message, 400);
  }
}
