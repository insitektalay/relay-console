import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type HunterCredentials = { apiKey: string };

export class HunterApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HunterApiAdapter {
  private readonly origin = "https://api.hunter.io";
  private readonly maxResponseBytes = 256 * 1024;
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: HunterCredentials) {
    await this.getAccountUsage(credentials);
    return { apiOrigin: this.origin, apiKeyValidated: true };
  }

  async getAccountUsage(credentials: HunterCredentials) {
    const response = this.object(
      (await this.request("/v2/account", credentials, {})).body,
    );
    const data = this.object(response.data);
    return {
      planName: this.optionalString(data.plan_name, 80),
      planLevel: this.integer(data.plan_level, 0, 100),
      resetDate: this.optionalDate(data.reset_date),
      requests: this.usage(this.object(data.requests)),
    };
  }

  async getDomainEmailCount(
    credentials: HunterCredentials,
    rawDomain: unknown,
  ) {
    const domain = this.domain(rawDomain);
    const response = this.object(
      (await this.request("/v2/email-count", credentials, { domain })).body,
    );
    const data = this.object(response.data);
    return {
      domain,
      total: this.requiredInteger(
        data.total,
        0,
        100_000_000,
        "Hunter returned an invalid total email count",
      ),
      personalEmails: this.requiredInteger(
        data.personal_emails,
        0,
        100_000_000,
        "Hunter returned an invalid personal email count",
      ),
      genericEmails: this.requiredInteger(
        data.generic_emails,
        0,
        100_000_000,
        "Hunter returned an invalid generic email count",
      ),
    };
  }

  async verifyEmail(credentials: HunterCredentials, rawEmail: unknown) {
    const email = this.email(rawEmail);
    const result = await this.request("/v2/email-verifier", credentials, {
      email,
    });
    if (result.status === 202) return { completed: false, status: "pending" };
    if (result.status === 222)
      throw new HunterApiError(
        "provider_unavailable",
        "Hunter could not complete this verification",
        502,
      );
    const data = this.object(this.object(result.body).data);
    const status = this.requiredEnum(
      data.status,
      ["valid", "invalid", "accept_all", "webmail", "disposable", "unknown"],
      "Hunter returned an invalid verification status",
    );
    return {
      completed: true,
      status,
      score: this.requiredInteger(
        data.score,
        0,
        100,
        "Hunter returned an invalid verification score",
      ),
      checks: {
        regexp: this.boolean(data.regexp),
        gibberish: this.boolean(data.gibberish),
        disposable: this.boolean(data.disposable),
        webmail: this.boolean(data.webmail),
        mxRecords: this.boolean(data.mx_records),
        smtpServer: this.boolean(data.smtp_server),
        smtpCheck: this.boolean(data.smtp_check),
        acceptAll: this.boolean(data.accept_all),
        blocked: this.boolean(data.block),
      },
    };
  }

  private async request(
    path: "/v2/account" | "/v2/email-count" | "/v2/email-verifier",
    credentials: HunterCredentials,
    parameters: Record<string, string>,
  ) {
    const apiKey =
      typeof credentials?.apiKey === "string" ? credentials.apiKey.trim() : "";
    if (
      apiKey.length < 16 ||
      apiKey.length > 512 ||
      /[\u0000-\u0020\u007f]/.test(apiKey)
    )
      throw new HunterApiError(
        "credential_missing",
        "A valid dedicated customer-owned Hunter API key is required",
        401,
      );
    const endpoint = new URL(path, this.origin);
    for (const [key, value] of Object.entries(parameters))
      endpoint.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.requester(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "RelayConsole-Hunter/1.0",
          "X-API-KEY": apiKey,
        },
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
    } catch {
      throw new HunterApiError(
        "provider_unavailable",
        "Hunter could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (response.status === 451)
      throw new HunterApiError(
        "provider_validation_error",
        "Hunter declined this request for legal or privacy reasons; do not process the email",
        451,
      );
    if (!response.ok)
      throw new HunterApiError(
        this.errorCode(response.status),
        `Hunter returned HTTP ${response.status}`,
        response.status,
      );
    return { body, status: response.status };
  }

  private usage(requests: JsonObject) {
    const result: JsonObject = {};
    for (const key of ["credits", "searches", "verifications"] as const) {
      const value = this.object(requests[key]);
      if (!Object.keys(value).length) continue;
      const used = this.number(value.used, 0, 1_000_000_000);
      const available = this.number(value.available, 0, 1_000_000_000);
      if (used === null || available === null)
        throw this.invalid("Hunter returned invalid account usage data");
      result[key] = { used, available };
    }
    return result;
  }
  private domain(value: unknown) {
    if (typeof value !== "string")
      throw this.invalid("domain must be a valid hostname");
    const domain = value.trim().toLowerCase();
    if (
      domain.length < 3 ||
      domain.length > 253 ||
      !/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        domain,
      )
    )
      throw this.invalid("domain must be a valid hostname");
    return domain;
  }
  private email(value: unknown) {
    if (typeof value !== "string")
      throw this.invalid("email must be a valid address");
    const email = value.trim().toLowerCase();
    if (
      email.length < 3 ||
      email.length > 254 ||
      !/^[^\s@<>]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(
        email,
      ) ||
      !email.split("@")[1]?.includes(".")
    )
      throw this.invalid("email must be a valid address");
    return email;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private boolean(value: unknown) {
    if (typeof value !== "boolean")
      throw this.invalid("Hunter returned invalid verification data");
    return value;
  }
  private number(value: unknown, min: number, max: number) {
    return typeof value === "number" &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max
      ? value
      : null;
  }
  private integer(value: unknown, min: number, max: number) {
    const number = this.number(value, min, max);
    return number !== null && Number.isInteger(number) ? number : null;
  }
  private requiredInteger(
    value: unknown,
    min: number,
    max: number,
    message: string,
  ) {
    const number = this.integer(value, min, max);
    if (number === null) throw this.invalid(message);
    return number;
  }
  private optionalString(value: unknown, max: number) {
    if (value === null || value === undefined) return null;
    if (
      typeof value !== "string" ||
      value.length > max ||
      /[\u0000-\u001f\u007f]/.test(value)
    )
      throw this.invalid("Hunter returned invalid account data");
    return value;
  }
  private optionalDate(value: unknown) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw this.invalid("Hunter returned an invalid reset date");
    return value;
  }
  private requiredEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
    message: string,
  ): T {
    if (typeof value !== "string" || !allowed.includes(value as T))
      throw this.invalid(message);
    return value as T;
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Hunter response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new HunterApiError(
        "provider_unavailable",
        "Hunter response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Hunter response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("Hunter returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Hunter returned invalid JSON");
      return {};
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new HunterApiError("provider_validation_error", message, 400);
  }
}
