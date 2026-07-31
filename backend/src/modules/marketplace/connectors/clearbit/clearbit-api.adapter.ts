import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ClearbitCredentials = { apiKey: string };
export type ClearbitLookupInput = { domain?: unknown };
export const CLEARBIT_READ_OPERATIONS = ["companies.find"] as const;

export class ClearbitApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class ClearbitApiAdapter {
  health(credentials: ClearbitCredentials) {
    this.requireCredentials(credentials);
    return { configured: true };
  }

  read(
    credentials: ClearbitCredentials,
    operation: string,
    input: ClearbitLookupInput,
  ) {
    this.rejectUnknownInput(input);
    if (!CLEARBIT_READ_OPERATIONS.includes(operation as never))
      throw new ClearbitApiError(
        "policy_blocked",
        "Clearbit operation is not in Relay's pinned company-lookup contract.",
        403,
      );
    return this.company(credentials, this.domain(input.domain));
  }

  private async company(credentials: ClearbitCredentials, domain: string) {
    this.requireCredentials(credentials);
    const root = new URL("https://company.clearbit.com/v2/");
    const url = new URL("companies/find", root);
    url.searchParams.set("domain", domain);
    if (
      url.origin !== root.origin ||
      url.pathname !== "/v2/companies/find" ||
      [...url.searchParams.keys()].some((key) => key !== "domain")
    )
      throw new ClearbitApiError(
        "policy_blocked",
        "Clearbit requests must stay on the pinned HTTPS Company API route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "Clearbit-Version": "2022-12-15",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ClearbitApiError(
        "provider_unavailable",
        "Clearbit could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Clearbit response exceeds Relay's 2.5 MB limit.");
    const data = this.parse(raw);
    if (response.status === 404) return { found: false, company: null };
    if (response.status === 202)
      throw new ClearbitApiError(
        "provider_unavailable",
        "Clearbit is refreshing this company record; retry later.",
        503,
      );
    if (!response.ok)
      throw new ClearbitApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Clearbit returned HTTP ${response.status}.`,
        response.status,
      );
    return { found: true, company: this.companySummary(data) };
  }

  private companySummary(value: unknown) {
    const company = this.object(value);
    return {
      ...this.pick(company, [
        "id",
        "name",
        "legalName",
        "domain",
        "description",
        "foundedYear",
        "indexedAt",
        "type",
      ]),
      category: this.pick(this.object(company.category), [
        "sector",
        "industryGroup",
        "industry",
        "subIndustry",
        "sicCode",
        "naicsCode",
      ]),
      metrics: this.pick(this.object(company.metrics), [
        "employees",
        "employeesRange",
        "estimatedAnnualRevenue",
        "fiscalYearEnd",
        "trafficRank",
      ]),
      tags: Array.isArray(company.tags)
        ? company.tags
            .filter((item): item is string => typeof item === "string")
            .slice(0, 25)
            .map((item) => item.slice(0, 200))
        : [],
    };
  }

  private pick(value: JsonObject, keys: string[]) {
    return Object.fromEntries(
      keys
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, this.scalar(value[key])]),
    );
  }

  private scalar(value: unknown) {
    if (typeof value === "string") return value.slice(0, 2_000);
    if (typeof value === "number" || typeof value === "boolean") return value;
    return null;
  }

  private domain(value: unknown) {
    if (typeof value !== "string")
      throw this.invalid("Clearbit domain must be a string.");
    const domain = value.trim().toLowerCase();
    if (
      domain.length > 253 ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
        domain,
      )
    )
      throw this.invalid("Clearbit domain must be a plain DNS hostname.");
    return domain;
  }

  private rejectUnknownInput(input: ClearbitLookupInput) {
    if (Object.keys(input).some((key) => key !== "domain"))
      throw new ClearbitApiError(
        "policy_blocked",
        "Clearbit accepts only the pinned domain lookup input.",
        403,
      );
  }

  private requireCredentials(credentials: ClearbitCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new ClearbitApiError(
        "credential_missing",
        "A valid legacy Clearbit API key is required.",
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

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    const body = this.object(value);
    const candidate =
      typeof body.error === "string" ? body.error : body.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new ClearbitApiError("provider_validation_error", message, 400);
  }
}
