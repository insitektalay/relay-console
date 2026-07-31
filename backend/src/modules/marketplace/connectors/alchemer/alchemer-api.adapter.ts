import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHmac, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type AlchemerRegion = "us" | "eu" | "ca" | "au";
export type AlchemerCredentials = {
  region: AlchemerRegion;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};
export type AlchemerOperationInput = {
  surveyId?: unknown;
  responseId?: unknown;
  page?: unknown;
  limit?: unknown;
};

export const ALCHEMER_READ_OPERATIONS = [
  "surveys.list",
  "surveys.get",
  "responses.list",
  "responses.get",
] as const;

const API_ORIGINS: Record<AlchemerRegion, string> = {
  us: "https://api.alchemer.com",
  eu: "https://api.alchemer.eu",
  ca: "https://api.alchemer-ca.com",
  au: "https://app.au.alchemer.com",
};

export class AlchemerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AlchemerApiAdapter {
  health(credentials: AlchemerCredentials) {
    return this.request(credentials, "survey", { page: 1, resultsperpage: 1 });
  }

  read(
    credentials: AlchemerCredentials,
    operation: string,
    input: AlchemerOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!ALCHEMER_READ_OPERATIONS.includes(operation as never)) {
      throw this.invalid(
        "Alchemer operation is not in Relay's pinned read-only contract.",
      );
    }
    if (operation === "surveys.list") {
      this.requireOnly(input, ["page", "limit"]);
      return this.request(credentials, "survey", this.paging(input));
    }
    const surveyId = this.id(input.surveyId, "surveyId");
    if (operation === "surveys.get") {
      this.requireOnly(input, ["surveyId"]);
      return this.request(credentials, `survey/${surveyId}`, {
        metaonly: "true",
      });
    }
    if (operation === "responses.list") {
      this.requireOnly(input, ["surveyId", "page", "limit"]);
      return this.request(
        credentials,
        `survey/${surveyId}/surveyresponse`,
        this.paging(input),
        true,
      );
    }
    this.requireOnly(input, ["surveyId", "responseId"]);
    return this.request(
      credentials,
      `survey/${surveyId}/surveyresponse/${this.id(input.responseId, "responseId")}`,
      {},
    );
  }

  private paging(input: AlchemerOperationInput) {
    return {
      page: this.integer(input.page, "page", 1, 10_000, 1),
      resultsperpage: this.integer(input.limit, "limit", 1, 25, 20),
    };
  }

  private async request(
    credentials: AlchemerCredentials,
    path: string,
    query: Record<string, string | number>,
    responseSummaries = false,
  ) {
    this.requireCredentials(credentials);
    const origin = API_ORIGINS[credentials.region];
    if (!origin) throw this.invalid("Select a supported Alchemer region.");
    const url = new URL(`/v5/${path.replace(/^\/+/, "")}`, origin);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    const authorization = this.authorization(credentials, url);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AlchemerApiError(
        "provider_unavailable",
        "Alchemer could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Alchemer response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok || this.providerRejected(data)) {
      const status = response.ok ? this.providerStatus(data) : response.status;
      throw new AlchemerApiError(
        this.safeCode(status),
        this.errorMessage(data) ?? `Alchemer returned HTTP ${status}.`,
        status,
      );
    }
    return responseSummaries ? this.responseSummaries(data) : data;
  }

  private authorization(credentials: AlchemerCredentials, url: URL) {
    const oauth: Record<string, string> = {
      oauth_consumer_key: credentials.consumerKey,
      oauth_nonce: randomBytes(18).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_token: credentials.accessToken,
      oauth_version: "1.0",
    };
    const parameters = [
      ...Array.from(url.searchParams.entries()),
      ...Object.entries(oauth),
    ]
      .map(([key, value]) => [this.encode(key), this.encode(value)] as const)
      .sort(([aKey, aValue], [bKey, bValue]) =>
        aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
      )
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const baseUrl = `${url.origin}${url.pathname}`;
    const signatureBase = [
      "GET",
      this.encode(baseUrl),
      this.encode(parameters),
    ].join("&");
    const signingKey = `${this.encode(credentials.consumerSecret)}&${this.encode(credentials.accessTokenSecret)}`;
    oauth.oauth_signature = createHmac("sha1", signingKey)
      .update(signatureBase)
      .digest("base64");
    return `OAuth ${Object.entries(oauth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${this.encode(key)}="${this.encode(value)}"`)
      .join(", ")}`;
  }

  private encode(value: string) {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private responseSummaries(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const data = Array.isArray(body.data)
      ? body.data.slice(0, 25).map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item))
            return null;
          const response = item as JsonObject;
          return Object.fromEntries(
            [
              "id",
              "survey_id",
              "status",
              "is_test_data",
              "date_submitted",
              "date_updated",
            ]
              .filter((key) => response[key] !== undefined)
              .map((key) => [key, response[key]]),
          );
        })
      : [];
    return { ...body, data };
  }

  private id(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[1-9]\d{0,18}$/.test(text))
      throw this.invalid(`Alchemer ${name} must be a positive integer.`);
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
    input: AlchemerOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "Alchemer input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: AlchemerOperationInput) {
    const allowed = new Set(["surveyId", "responseId", "page", "limit"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new AlchemerApiError(
        "policy_blocked",
        "Alchemer accepts only pinned operation inputs.",
        403,
      );
  }

  private requireCredentials(credentials: AlchemerCredentials) {
    for (const [name, value] of [
      ["consumer key", credentials.consumerKey],
      ["consumer secret", credentials.consumerSecret],
      ["access token", credentials.accessToken],
      ["access token secret", credentials.accessTokenSecret],
    ] as const) {
      if (!value || value.length > 16_000 || /[\r\n]/.test(value))
        throw new AlchemerApiError(
          "credential_missing",
          `A valid Alchemer ${name} is required.`,
          401,
        );
    }
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
          /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url|ip_address|user_agent)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private providerRejected(value: unknown) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as JsonObject).result_ok === false,
    );
  }

  private providerStatus(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return 400;
    const code = Number((value as JsonObject).code);
    return Number.isInteger(code) && code >= 400 && code <= 599 ? code : 400;
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
    return new AlchemerApiError("provider_validation_error", message, 400);
  }
}
