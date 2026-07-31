import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SecureframeCredentials = {
  region: string;
  apiKey: string;
  apiSecret: string;
};
export const SECUREFRAME_OPERATIONS = ["frameworks.list"] as const;

export class SecureframeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class SecureframeApiAdapter {
  async health(credentials: SecureframeCredentials) {
    const result = await this.read(credentials, {
      operation: "frameworks.list",
      page: 1,
      perPage: 1,
    });
    return {
      region: this.region(credentials.region),
      frameworkDirectoryVerified: true,
      visibleCountAtLeast: result.frameworks.length,
    };
  }

  async read(credentials: SecureframeCredentials, input: JsonObject) {
    if (input.operation !== "frameworks.list")
      throw new SecureframeApiError(
        "policy_blocked",
        "Secureframe operation is outside Relay's pinned framework directory.",
        403,
      );
    const page = this.integer(input.page, 1, 1_000, 1);
    const perPage = this.integer(input.perPage, 1, 20, 20);
    const url = new URL("/frameworks", this.origin(credentials.region));
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `${this.credential(credentials.apiKey, "API key")} ${this.credential(credentials.apiSecret, "API secret")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new SecureframeApiError(
        "provider_unavailable",
        "Secureframe API could not be reached.",
        502,
      );
    }
    const body = await this.body(response);
    if (!response.ok)
      throw new SecureframeApiError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status >= 500
            ? "provider_unavailable"
            : response.status === 401 || response.status === 403
              ? "credential_missing"
              : "provider_validation_error",
        this.text(body.message ?? body.error, 500) ??
          `Secureframe returned HTTP ${response.status}.`,
        response.status || 400,
      );
    if (!Array.isArray(body.data))
      throw new SecureframeApiError(
        "provider_validation_error",
        "Secureframe returned an invalid framework directory.",
        502,
      );
    return {
      frameworks: body.data
        .slice(0, perPage)
        .map((entry) => this.object(entry))
        .map((item) => {
          const attributes = this.object(item.attributes);
          return {
            id: this.id(item.id),
            name: this.text(attributes.name ?? attributes.title, 250),
            status: this.text(attributes.status, 80),
            enabled:
              typeof attributes.enabled === "boolean"
                ? attributes.enabled
                : null,
            createdAt: this.text(attributes.created_at, 80),
            updatedAt: this.text(attributes.updated_at, 80),
          };
        })
        .filter((item) => item.id),
      page,
      perPage,
    };
  }

  private origin(value: string) {
    return this.region(value) === "uk"
      ? "https://api-uk.secureframe.com"
      : "https://api.secureframe.com";
  }
  private region(value: string) {
    const region = value.trim().toLowerCase();
    if (region !== "us" && region !== "uk")
      throw new SecureframeApiError(
        "provider_validation_error",
        "Secureframe region must be us or uk.",
      );
    return region;
  }
  private credential(value: string, label: string) {
    if (!value || value.length > 2_000 || /[\r\n ]/.test(value))
      throw new SecureframeApiError(
        "credential_missing",
        `A valid Secureframe ${label} is required.`,
        401,
      );
    return value;
  }
  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new SecureframeApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }
  private async body(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 500_000)
      throw new SecureframeApiError(
        "provider_validation_error",
        "Secureframe response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }
  private id(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value)
      ? value
      : null;
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
