import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type AdobeMarketoEngageCredentials = {
  instanceOrigin: string;
  clientId: string;
  clientSecret: string;
};

export const ADOBE_MARKETO_ENGAGE_OPERATIONS = ["programs.list"] as const;

export class AdobeMarketoEngageApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class AdobeMarketoEngageApiAdapter {
  async health(credentials: AdobeMarketoEngageCredentials) {
    const result = await this.read(credentials, {
      operation: "programs.list",
      offset: 0,
      maxReturn: 1,
    });
    return {
      instanceOrigin: this.normalizeOrigin(credentials.instanceOrigin),
      programDirectoryVerified: true,
      visibleProgramCountAtLeast: result.programs.length,
    };
  }

  async read(credentials: AdobeMarketoEngageCredentials, input: JsonObject) {
    const operation = this.requiredString(input.operation, "operation", 80);
    if (!ADOBE_MARKETO_ENGAGE_OPERATIONS.includes(operation as never))
      throw new AdobeMarketoEngageApiError(
        "policy_blocked",
        "Marketo operation is outside Relay's pinned program-directory contract.",
        403,
      );
    const origin = this.normalizeOrigin(credentials.instanceOrigin);
    const token = await this.accessToken(origin, credentials);
    const offset = this.integer(input.offset, 0, 10_000, 0);
    const maxReturn = this.integer(input.maxReturn, 1, 20, 20);
    const url = new URL("/rest/asset/v1/programs.json", origin);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("maxReturn", String(maxReturn));
    const body = await this.request(url, token);
    const programs = Array.isArray(body.result)
      ? body.result.slice(0, maxReturn).map((item) => this.object(item))
      : null;
    if (!programs)
      throw new AdobeMarketoEngageApiError(
        "provider_validation_error",
        "Marketo returned an invalid program directory.",
        502,
      );
    return {
      programs: programs
        .map((program) => ({
          id: this.identifier(program.id),
          name: this.string(program.name, 250),
          type: this.string(program.type, 100),
          channel: this.string(program.channel, 150),
          status: this.string(program.status, 100),
          createdAt: this.string(program.createdAt, 80),
          updatedAt: this.string(program.updatedAt, 80),
        }))
        .filter((program) => program.id),
      offset,
      maxReturn,
      moreResult: body.moreResult === true,
    };
  }

  normalizeOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new AdobeMarketoEngageApiError(
        "provider_validation_error",
        "Marketo instance origin is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      !/^[a-z0-9-]+\.mktorest\.com$/i.test(url.hostname) ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new AdobeMarketoEngageApiError(
        "provider_validation_error",
        "Marketo instance origin must be an HTTPS mktorest.com origin with no path.",
      );
    return url.origin;
  }

  private async accessToken(
    origin: string,
    credentials: AdobeMarketoEngageCredentials,
  ) {
    const clientId = this.credential(credentials.clientId, "client ID");
    const clientSecret = this.credential(
      credentials.clientSecret,
      "client secret",
    );
    let response: Response;
    try {
      response = await safeConnectorFetch(new URL("/identity/oauth/token", origin), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AdobeMarketoEngageApiError(
        "provider_unavailable",
        "Marketo identity endpoint could not be reached.",
        502,
      );
    }
    const body = await this.parseResponse(response, 100_000);
    const token = this.string(body.access_token, 32_000);
    if (!response.ok || !token)
      throw new AdobeMarketoEngageApiError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status >= 500
            ? "provider_unavailable"
            : "credential_missing",
        this.errorMessage(body) ??
          "Marketo rejected the custom-service credentials.",
        response.status || 401,
      );
    return token;
  }

  private async request(url: URL, accessToken: string) {
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
      throw new AdobeMarketoEngageApiError(
        "provider_unavailable",
        "Marketo REST API could not be reached.",
        502,
      );
    }
    const body = await this.parseResponse(response, 500_000);
    if (!response.ok || body.success === false)
      throw new AdobeMarketoEngageApiError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status >= 500
            ? "provider_unavailable"
            : response.status === 401 || response.status === 403
              ? "credential_missing"
              : "provider_validation_error",
        this.errorMessage(body) ?? `Marketo returned HTTP ${response.status}.`,
        response.status || 400,
      );
    return body;
  }

  private async parseResponse(response: Response, limit: number) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > limit)
      throw new AdobeMarketoEngageApiError(
        "provider_validation_error",
        "Marketo response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private errorMessage(body: JsonObject) {
    const errors = Array.isArray(body.errors) ? body.errors : [];
    const first = this.object(errors[0]);
    const candidate = first.message ?? body.error_description ?? body.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private credential(value: string, label: string) {
    if (!value || value.length > 2_000 || /[\r\n]/.test(value))
      throw new AdobeMarketoEngageApiError(
        "credential_missing",
        `A valid Marketo ${label} is required.`,
        401,
      );
    return value;
  }

  private requiredString(value: unknown, label: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new AdobeMarketoEngageApiError(
        "provider_validation_error",
        `${label} is invalid.`,
      );
    return value.trim();
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new AdobeMarketoEngageApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }

  private identifier(value: unknown) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
      return String(value);
    return typeof value === "string" && /^[1-9][0-9]{0,30}$/.test(value)
      ? value
      : null;
  }

  private string(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
