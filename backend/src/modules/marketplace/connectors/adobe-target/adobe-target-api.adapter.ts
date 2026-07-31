import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type AdobeTargetCredentials = {
  tenant: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
};

export const ADOBE_TARGET_OPERATIONS = ["activities.list"] as const;

export class AdobeTargetApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class AdobeTargetApiAdapter {
  async health(credentials: AdobeTargetCredentials) {
    const result = await this.read(credentials, {
      operation: "activities.list",
      offset: 0,
      limit: 1,
    });
    return {
      tenant: this.tenant(credentials.tenant),
      activityDirectoryVerified: true,
      visibleActivityCountAtLeast: result.activities.length,
    };
  }

  async read(credentials: AdobeTargetCredentials, input: JsonObject) {
    const operation = this.requiredString(input.operation, "operation", 80);
    if (!ADOBE_TARGET_OPERATIONS.includes(operation as never))
      throw new AdobeTargetApiError(
        "policy_blocked",
        "Adobe Target operation is outside Relay's pinned activity-directory contract.",
        403,
      );
    const tenant = this.tenant(credentials.tenant);
    const accessToken = await this.accessToken(credentials);
    const offset = this.integer(input.offset, 0, 10_000, 0);
    const limit = this.integer(input.limit, 1, 20, 20);
    const url = new URL(
      `/${encodeURIComponent(tenant)}/target/activities/`,
      "https://mc.adobe.io",
    );
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const body = await this.request(url, accessToken, credentials.clientId);
    const activities = Array.isArray(body.activities)
      ? body.activities.slice(0, limit).map((item) => this.object(item))
      : null;
    if (!activities)
      throw new AdobeTargetApiError(
        "provider_validation_error",
        "Adobe Target returned an invalid activity directory.",
        502,
      );
    return {
      activities: activities
        .map((activity) => ({
          id: this.identifier(activity.id),
          name: this.string(activity.name, 250),
          type: this.string(activity.type, 80),
          state: this.string(activity.state, 80),
          priority: this.safeNumber(activity.priority),
          startsAt: this.string(activity.startsAt, 80),
          endsAt: this.string(activity.endsAt, 80),
          createdAt: this.string(activity.createdAt, 80),
          modifiedAt: this.string(activity.modifiedAt, 80),
          workspace: this.identifier(activity.workspace),
        }))
        .filter((activity) => activity.id),
      offset,
      limit,
      total: this.safeNumber(body.total),
    };
  }

  private async accessToken(credentials: AdobeTargetCredentials) {
    const clientId = this.credential(credentials.clientId, "client ID");
    const clientSecret = this.credential(
      credentials.clientSecret,
      "client secret",
    );
    const scopes = this.scopes(credentials.scopes);
    let response: Response;
    try {
      response = await safeConnectorFetch("https://ims-na1.adobelogin.com/ims/token/v3", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: scopes,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AdobeTargetApiError(
        "provider_unavailable",
        "Adobe IMS could not be reached.",
        502,
      );
    }
    const body = await this.parseResponse(response, 100_000);
    const token = this.string(body.access_token, 32_000);
    if (!response.ok || !token)
      throw new AdobeTargetApiError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status >= 500
            ? "provider_unavailable"
            : "credential_missing",
        this.errorMessage(body) ??
          "Adobe IMS rejected the Target server-to-server credentials.",
        response.status || 401,
      );
    return token;
  }

  private async request(url: URL, accessToken: string, rawClientId: string) {
    const clientId = this.credential(rawClientId, "client ID");
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.adobe.target.v3+json",
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": clientId,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AdobeTargetApiError(
        "provider_unavailable",
        "Adobe Target Admin API could not be reached.",
        502,
      );
    }
    const body = await this.parseResponse(response, 500_000);
    if (!response.ok)
      throw new AdobeTargetApiError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status >= 500
            ? "provider_unavailable"
            : response.status === 401 || response.status === 403
              ? "credential_missing"
              : "provider_validation_error",
        this.errorMessage(body) ??
          `Adobe Target returned HTTP ${response.status}.`,
        response.status || 400,
      );
    return body;
  }

  private async parseResponse(response: Response, limit: number) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > limit)
      throw new AdobeTargetApiError(
        "provider_validation_error",
        "Adobe Target response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private tenant(value: string) {
    const tenant = value?.trim();
    if (!tenant || !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(tenant))
      throw new AdobeTargetApiError(
        "provider_validation_error",
        "Adobe Target tenant must be the account tenant code, not a URL.",
      );
    return tenant;
  }

  private scopes(value: string) {
    const scopes = value?.trim();
    if (
      !scopes ||
      scopes.length > 2_000 ||
      /[\r\n]/.test(scopes) ||
      !/^[A-Za-z0-9._:,/ -]+$/.test(scopes)
    )
      throw new AdobeTargetApiError(
        "credential_missing",
        "Valid Adobe OAuth server-to-server scopes are required.",
        401,
      );
    return scopes;
  }

  private credential(value: string, label: string) {
    if (!value || value.length > 2_000 || /[\r\n]/.test(value))
      throw new AdobeTargetApiError(
        "credential_missing",
        `A valid Adobe Target ${label} is required.`,
        401,
      );
    return value;
  }

  private requiredString(value: unknown, label: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new AdobeTargetApiError(
        "provider_validation_error",
        `${label} is invalid.`,
      );
    return value.trim();
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new AdobeTargetApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }

  private identifier(value: unknown) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
      return String(value);
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,250}$/.test(value)
      ? value
      : null;
  }

  private safeNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private string(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private errorMessage(body: JsonObject) {
    const errors = Array.isArray(body.errors) ? body.errors : [];
    const first = this.object(errors[0]);
    const candidate =
      first.message ?? body.error_description ?? body.error ?? body.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
