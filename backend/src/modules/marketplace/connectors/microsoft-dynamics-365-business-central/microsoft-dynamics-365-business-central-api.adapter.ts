import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_OPERATIONS = [
  "companies.list",
] as const;

export class MicrosoftDynamics365BusinessCentralApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class MicrosoftDynamics365BusinessCentralApiAdapter {
  health(accessToken: string, environmentName: string) {
    return this.read(accessToken, environmentName, "companies.list");
  }

  read(accessToken: string, environmentName: string, operation: string) {
    if (
      !MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_OPERATIONS.includes(
        operation as never,
      )
    )
      throw new MicrosoftDynamics365BusinessCentralApiError(
        "policy_blocked",
        "Microsoft Dynamics 365 Business Central operation is outside Relay's pinned company-directory contract.",
        403,
      );
    return this.listCompanies(accessToken, environmentName);
  }

  normalizeEnvironmentName(value: string) {
    const environmentName = value.trim();
    if (
      !environmentName ||
      environmentName.length > 80 ||
      !/^[a-z0-9][a-z0-9._-]*$/i.test(environmentName)
    )
      throw new MicrosoftDynamics365BusinessCentralApiError(
        "provider_validation_error",
        "Enter a Business Central environment name using letters, numbers, dots, hyphens, or underscores.",
        400,
      );
    return environmentName;
  }

  private async listCompanies(accessToken: string, environmentValue: string) {
    if (
      !accessToken ||
      accessToken.length > 32_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new MicrosoftDynamics365BusinessCentralApiError(
        "credential_missing",
        "A valid Microsoft access token is required.",
        401,
      );
    const environmentName = this.normalizeEnvironmentName(environmentValue);
    const url = new URL(
      `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(environmentName)}/api/v2.0/companies`,
    );
    url.searchParams.set("$select", "id,name,displayName");
    url.searchParams.set("$top", "50");
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MicrosoftDynamics365BusinessCentralApiError(
        "provider_unavailable",
        "Microsoft Dynamics 365 Business Central could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 250_000)
      throw this.invalid(
        "Business Central response exceeds Relay's 250 KB limit.",
      );
    const data = this.parse(raw);
    if (!response.ok)
      throw new MicrosoftDynamics365BusinessCentralApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Microsoft Dynamics 365 Business Central returned HTTP ${response.status}.`,
        response.status,
      );
    const body = this.object(data);
    const companies = Array.isArray(body.value)
      ? body.value.slice(0, 50).map((entry) => {
          const company = this.object(entry);
          return {
            id: this.guid(company.id),
            name: this.string(company.name, 250),
            displayName: this.string(company.displayName, 250),
          };
        })
      : [];
    return { environmentName, companies };
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
    if (status === 401 || status === 403) return "credential_missing";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    const body = this.object(value);
    const nested = this.object(body.error);
    const candidate = nested.message ?? body.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private guid(value: unknown) {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value
      : null;
  }

  private string(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.slice(0, maxLength) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new MicrosoftDynamics365BusinessCentralApiError(
      "provider_validation_error",
      message,
      400,
    );
  }
}
