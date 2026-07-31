import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ZoomInfoCredentials = { clientId: string; clientSecret: string };
export type ZoomInfoSearchInput = { companyName?: unknown };
export const ZOOMINFO_READ_OPERATIONS = ["companies.search"] as const;

export class ZoomInfoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class ZoomInfoApiAdapter {
  health(credentials: ZoomInfoCredentials) {
    return this.accessToken(credentials).then(() => ({ authenticated: true }));
  }

  async read(
    credentials: ZoomInfoCredentials,
    operation: string,
    input: ZoomInfoSearchInput,
  ) {
    this.rejectUnknownInput(input);
    if (!ZOOMINFO_READ_OPERATIONS.includes(operation as never))
      throw new ZoomInfoApiError(
        "policy_blocked",
        "ZoomInfo operation is not in Relay's pinned company-search contract.",
        403,
      );
    const accessToken = await this.accessToken(credentials);
    return this.searchCompanies(
      accessToken,
      this.companyName(input.companyName),
    );
  }

  private async accessToken(credentials: ZoomInfoCredentials) {
    this.requireCredentials(credentials);
    let response: Response;
    try {
      response = await safeConnectorFetch("https://api.zoominfo.com/gtm/oauth/v1/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "api:data:company",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ZoomInfoApiError(
        "provider_unavailable",
        "ZoomInfo authentication could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 250_000)
      throw this.invalid("ZoomInfo token response exceeds Relay's limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new ZoomInfoApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `ZoomInfo authentication returned HTTP ${response.status}.`,
        response.status,
      );
    const token = this.object(data).access_token;
    if (
      typeof token !== "string" ||
      !token ||
      token.length > 16_000 ||
      /[\r\n]/.test(token)
    )
      throw new ZoomInfoApiError(
        "provider_validation_error",
        "ZoomInfo returned an invalid access token.",
        502,
      );
    return token;
  }

  private async searchCompanies(accessToken: string, companyName: string) {
    const root = new URL("https://api.zoominfo.com/gtm/");
    const url = new URL(
      "data/v1/companies/search?page[number]=1&page[size]=20&sort=name",
      root,
    );
    if (
      url.origin !== root.origin ||
      url.pathname !== "/gtm/data/v1/companies/search"
    )
      throw new ZoomInfoApiError(
        "policy_blocked",
        "ZoomInfo requests must stay on the pinned HTTPS company-search route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.api+json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: JSON.stringify({
          data: {
            type: "CompanySearch",
            attributes: { companyName, excludeDefunctCompanies: true },
          },
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ZoomInfoApiError(
        "provider_unavailable",
        "ZoomInfo could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("ZoomInfo response exceeds Relay's 2.5 MB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new ZoomInfoApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `ZoomInfo returned HTTP ${response.status}.`,
        response.status,
      );
    return this.companyPreviews(data);
  }

  private companyPreviews(value: unknown) {
    const body = this.object(value);
    const rows = Array.isArray(body.data) ? body.data : [];
    const meta = this.object(body.meta);
    return {
      totalResults: this.integerOrNull(meta.totalResults),
      results: rows.slice(0, 20).map((item) => {
        const resource = this.object(item);
        const attributes = this.object(resource.attributes);
        return {
          id: this.scalar(resource.id),
          type: resource.type === "Company" ? "Company" : undefined,
          attributes: Object.fromEntries(
            ["name", "website", "city", "state", "country"]
              .filter((key) => attributes[key] !== undefined)
              .map((key) => [key, this.scalar(attributes[key])]),
          ),
        };
      }),
      hasMore: false,
    };
  }

  private companyName(value: unknown) {
    if (typeof value !== "string")
      throw this.invalid("ZoomInfo companyName must be a string.");
    const name = value.trim();
    if (name.length < 2 || name.length > 160 || /[\r\n]/.test(name))
      throw this.invalid(
        "ZoomInfo companyName must contain 2 to 160 single-line characters.",
      );
    return name;
  }

  private rejectUnknownInput(input: ZoomInfoSearchInput) {
    if (Object.keys(input).some((key) => key !== "companyName"))
      throw new ZoomInfoApiError(
        "policy_blocked",
        "ZoomInfo accepts only the pinned company-name search input.",
        403,
      );
  }

  private requireCredentials(credentials: ZoomInfoCredentials) {
    if (
      ![credentials.clientId, credentials.clientSecret].every(
        (value) => value && value.length <= 16_000 && !/[\r\n]/.test(value),
      )
    )
      throw new ZoomInfoApiError(
        "credential_missing",
        "Valid ZoomInfo client credentials are required.",
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
    const first = Array.isArray(body.errors) ? this.object(body.errors[0]) : {};
    const candidate = body.message ?? first.detail ?? first.title ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private integerOrNull(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  private scalar(value: unknown) {
    if (typeof value === "string") return value.slice(0, 2_000);
    if (typeof value === "number" || typeof value === "boolean") return value;
    return undefined;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new ZoomInfoApiError("provider_validation_error", message, 400);
  }
}
