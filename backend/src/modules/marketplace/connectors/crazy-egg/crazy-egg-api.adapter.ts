import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type CrazyEggCredentials = { apiKey: string };

export class CrazyEggApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CrazyEggApiAdapter {
  private static readonly ENDPOINT = "https://track.crazyegg.com/api/v1";
  private static readonly CONVERSION_KEYS = new Set([
    "goalName",
    "userIdentifier",
    "url",
    "value",
    "currency",
    "visitCount",
    "landingPage",
    "referrer",
    "country",
    "userAgent",
    "utmParams",
    "customData",
    "timestamp",
  ]);

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: CrazyEggCredentials) {
    this.key(credentials.apiKey);
    return {
      apiKeyPresent: true,
      siteScopedKeyRequired: true,
      liveVerificationPerformed: false,
      conversionCreated: false,
      analyticsReturned: false,
      writesEnabled: true,
    };
  }

  async recordConversions(credentials: CrazyEggCredentials, input: JsonObject) {
    const apiKey = this.key(credentials.apiKey);
    const conversions = this.conversions(input);
    const body = JSON.stringify({ goalConversions: conversions });
    if (Buffer.byteLength(body) > 64_000)
      throw this.validation("Crazy Egg conversion payload exceeds 64 KB.");
    let response: Response;
    try {
      response = await this.request(CrazyEggApiAdapter.ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new CrazyEggApiError(
        "provider_unavailable",
        "Crazy Egg Conversion Tracking API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Crazy Egg response exceeded Relay's 1 MB bound.");
    if (!response.ok)
      throw new CrazyEggApiError(
        this.errorCode(response.status),
        "Crazy Egg rejected the bounded conversion request.",
        response.status,
      );
    return {
      semanticWriteContract: "crazy-egg-conversion-record-v1",
      acceptedCount: conversions.length,
      siteScopedApiKeyVerified: true,
      providerRequestCount: 1,
      providerResponseReturned: false,
      visitorIdentifiersReturned: false,
      analyticsReturned: false,
      recordingsReturned: false,
      writesEnabled: true,
      automaticRetries: false,
    };
  }

  private conversions(input: JsonObject) {
    if (
      Object.keys(input).some((key) => key !== "goalConversions") ||
      !Array.isArray(input.goalConversions) ||
      input.goalConversions.length < 1 ||
      input.goalConversions.length > 25
    )
      throw this.validation("goalConversions must contain 1 to 25 items.");
    return input.goalConversions.map((entry, index) => {
      const value = this.object(entry);
      if (
        Object.keys(value).some(
          (key) => !CrazyEggApiAdapter.CONVERSION_KEYS.has(key),
        )
      )
        throw this.validation(
          `goalConversions[${index}] contains an unsupported field.`,
        );
      const result: JsonObject = {
        goalName: this.requiredString(value.goalName, 128, "goalName"),
        userIdentifier: this.requiredString(
          value.userIdentifier,
          256,
          "userIdentifier",
        ),
      };
      this.optionalUrl(result, "url", value.url);
      this.optionalNumber(result, "value", value.value);
      this.optionalPattern(result, "currency", value.currency, /^[A-Z]{3}$/);
      this.optionalInteger(
        result,
        "visitCount",
        value.visitCount,
        0,
        1_000_000,
      );
      this.optionalUrl(result, "landingPage", value.landingPage);
      this.optionalUrl(result, "referrer", value.referrer);
      this.optionalPattern(result, "country", value.country, /^[A-Z]{2}$/);
      this.optionalString(result, "userAgent", value.userAgent, 512);
      if (value.utmParams !== undefined)
        result.utmParams = this.stringMap(value.utmParams, 5, 256, [
          "source",
          "medium",
          "term",
          "content",
          "campaign",
        ]);
      if (value.customData !== undefined)
        result.customData = this.stringMap(value.customData, 5, 512);
      if (value.timestamp !== undefined) {
        const timestamp = this.requiredString(value.timestamp, 64, "timestamp");
        if (
          !/^\d{4}-\d{2}-\d{2}T/.test(timestamp) ||
          Number.isNaN(Date.parse(timestamp))
        )
          throw this.validation("timestamp must be a valid ISO 8601 value.");
        result.timestamp = timestamp;
      }
      return result;
    });
  }

  private key(value: string) {
    const key = value?.trim();
    if (!key || key.length > 20_000)
      throw new CrazyEggApiError(
        "credential_missing",
        "Crazy Egg site API key is missing.",
        401,
      );
    return key;
  }

  private requiredString(value: unknown, max: number, name: string) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(
        `${name} must be a non-empty string up to ${max} characters.`,
      );
    return value.trim();
  }

  private optionalString(
    target: JsonObject,
    key: string,
    value: unknown,
    max: number,
  ) {
    if (value === undefined) return;
    target[key] = this.requiredString(value, max, key);
  }

  private optionalUrl(target: JsonObject, key: string, value: unknown) {
    if (value === undefined) return;
    const raw = this.requiredString(value, 2048, key);
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw this.validation(`${key} must be an absolute HTTPS URL.`);
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      throw this.validation(
        `${key} must be an absolute HTTPS URL without credentials.`,
      );
    target[key] = parsed.toString();
  }

  private optionalNumber(target: JsonObject, key: string, value: unknown) {
    if (value === undefined) return;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      Math.abs(value) > 1e12
    )
      throw this.validation(`${key} must be a finite number within bounds.`);
    target[key] = value;
  }

  private optionalInteger(
    target: JsonObject,
    key: string,
    value: unknown,
    minimum: number,
    maximum: number,
  ) {
    if (value === undefined) return;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < minimum ||
      Number(value) > maximum
    )
      throw this.validation(
        `${key} must be an integer from ${minimum} to ${maximum}.`,
      );
    target[key] = value;
  }

  private optionalPattern(
    target: JsonObject,
    key: string,
    value: unknown,
    pattern: RegExp,
  ) {
    if (value === undefined) return;
    if (typeof value !== "string" || !pattern.test(value))
      throw this.validation(`${key} has an invalid format.`);
    target[key] = value;
  }

  private stringMap(
    value: unknown,
    maxEntries: number,
    maxValueLength: number,
    allowedKeys?: string[],
  ) {
    const source = this.object(value);
    const entries = Object.entries(source);
    if (entries.length > maxEntries)
      throw this.validation(`Object may contain at most ${maxEntries} fields.`);
    const result: Record<string, string> = {};
    for (const [key, item] of entries) {
      if (allowedKeys && !allowedKeys.includes(key))
        throw this.validation(`${key} is not an allowed metadata field.`);
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(key))
        throw this.validation("Metadata field name is invalid.");
      result[key] = this.requiredString(item, maxValueLength, key);
    }
    return result;
  }

  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.validation("Conversion entries must be objects.");
    return value as JsonObject;
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new CrazyEggApiError("provider_validation_error", message);
  }
}
