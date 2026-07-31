import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type QualtricsCredentials = { dataCenterId: string; apiToken: string };
export type QualtricsOperationInput = { surveyId?: unknown; offset?: unknown };

export const QUALTRICS_READ_OPERATIONS = [
  "identity.get",
  "surveys.list",
  "surveys.get",
] as const;

export class QualtricsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class QualtricsApiAdapter {
  health(credentials: QualtricsCredentials) {
    return this.request(credentials, "whoami");
  }

  read(
    credentials: QualtricsCredentials,
    operation: string,
    input: QualtricsOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!QUALTRICS_READ_OPERATIONS.includes(operation as never))
      throw this.invalid(
        "Qualtrics operation is not in Relay's pinned read-only contract.",
      );
    if (operation === "identity.get") {
      this.requireOnly(input, []);
      return this.request(credentials, "whoami");
    }
    if (operation === "surveys.list") {
      this.requireOnly(input, ["offset"]);
      return this.request(
        credentials,
        `surveys?offset=${this.integer(input.offset, "offset", 0, 10_000, 0)}`,
        true,
      );
    }
    this.requireOnly(input, ["surveyId"]);
    return this.request(
      credentials,
      `surveys/${this.id(input.surveyId, "surveyId", /^SV_[A-Za-z0-9]{8,100}$/)}`,
    );
  }

  private async request(
    credentials: QualtricsCredentials,
    target: string,
    surveyList = false,
  ) {
    this.requireCredentials(credentials);
    const origin = `https://${credentials.dataCenterId}.qualtrics.com`;
    const root = new URL("/API/v3/", origin);
    const url = new URL(target, root);
    if (
      url.origin !== origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new QualtricsApiError(
        "policy_blocked",
        "Qualtrics requests must stay on the configured data center's HTTPS API v3 route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-TOKEN": credentials.apiToken,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new QualtricsApiError(
        "provider_unavailable",
        "The configured Qualtrics data center could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Qualtrics response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new QualtricsApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Qualtrics returned HTTP ${response.status}.`,
        response.status,
      );
    return surveyList ? this.surveyList(data) : data;
  }

  private surveyList(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const result =
      body.result &&
      typeof body.result === "object" &&
      !Array.isArray(body.result)
        ? (body.result as JsonObject)
        : {};
    const elements = Array.isArray(result.elements)
      ? result.elements.slice(0, 25).map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item))
            return null;
          const survey = item as JsonObject;
          return Object.fromEntries(
            [
              "id",
              "name",
              "ownerId",
              "lastModified",
              "creationDate",
              "isActive",
            ]
              .filter((key) => survey[key] !== undefined)
              .map((key) => [key, survey[key]]),
          );
        })
      : [];
    return {
      result: { elements, hasMore: Boolean(result.nextPage) },
      meta: body.meta,
    };
  }

  private requireCredentials(credentials: QualtricsCredentials) {
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(credentials.dataCenterId)
    )
      throw new QualtricsApiError(
        "credential_missing",
        "A valid Qualtrics data center ID is required.",
        401,
      );
    if (
      !credentials.apiToken ||
      credentials.apiToken.length > 16_000 ||
      /[\r\n]/.test(credentials.apiToken)
    )
      throw new QualtricsApiError(
        "credential_missing",
        "A valid Qualtrics API token is required.",
        401,
      );
  }

  private id(value: unknown, name: string, pattern: RegExp) {
    const text = String(value ?? "").trim();
    if (!pattern.test(text))
      throw this.invalid(`Qualtrics ${name} is invalid.`);
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
    input: QualtricsOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "Qualtrics input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: QualtricsOperationInput) {
    const allowed = new Set(["surveyId", "offset"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new QualtricsApiError(
        "policy_blocked",
        "Qualtrics accepts only pinned operation inputs.",
        403,
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
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url)/i.test(
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
    const meta =
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? (body.meta as JsonObject)
        : {};
    const candidate = meta.error?.toString() ?? body.message ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new QualtricsApiError("provider_validation_error", message, 400);
  }
}
