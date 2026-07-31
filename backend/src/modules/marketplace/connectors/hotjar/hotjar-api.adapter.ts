import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type HotjarCredentials = {
  clientId: string;
  clientSecret: string;
  siteId: string;
};
export type HotjarOperationInput = {
  limit?: unknown;
  cursor?: unknown;
  surveyId?: unknown;
};
export const HOTJAR_READ_OPERATIONS = [
  "surveys.list",
  "survey.get",
  "responses.list",
] as const;

export class HotjarApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HotjarApiAdapter {
  health(credentials: HotjarCredentials) {
    return this.read(credentials, "surveys.list", { limit: 1 });
  }

  async read(
    credentials: HotjarCredentials,
    operation: string,
    input: HotjarOperationInput,
  ) {
    this.requireCredentials(credentials);
    this.rejectUnknownInput(input);
    if (!HOTJAR_READ_OPERATIONS.includes(operation as never))
      throw this.invalid(
        "Hotjar operation is outside Relay's pinned read-only contract.",
      );
    const site = encodeURIComponent(credentials.siteId);
    let target: string;
    let query: Record<string, string | number> = {};
    if (operation === "surveys.list") {
      this.requireOnly(input, ["limit", "cursor"]);
      target = `sites/${site}/surveys`;
      query = {
        limit: this.integer(input.limit, "limit", 1, 25, 20),
        ...this.cursor(input.cursor),
        with_questions: "false",
      };
    } else {
      const surveyId = encodeURIComponent(this.surveyId(input.surveyId));
      if (operation === "survey.get") {
        this.requireOnly(input, ["surveyId"]);
        target = `sites/${site}/surveys/${surveyId}`;
      } else {
        this.requireOnly(input, ["surveyId", "limit", "cursor"]);
        target = `sites/${site}/surveys/${surveyId}/responses`;
        query = {
          limit: this.integer(input.limit, "limit", 1, 25, 20),
          ...this.cursor(input.cursor),
        };
      }
    }
    const token = await this.accessToken(credentials);
    const data = await this.request(token, target, query);
    return operation === "responses.list"
      ? this.minimizeResponses(data)
      : operation === "surveys.list"
        ? this.minimizeSurveys(data)
        : this.minimizeSurvey(data);
  }

  private async accessToken(credentials: HotjarCredentials) {
    let response: Response;
    try {
      response = await safeConnectorFetch("https://api.hotjar.io/v1/oauth/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new HotjarApiError(
        "provider_unavailable",
        "Hotjar authentication could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 250_000)
      throw this.invalid("Hotjar token response exceeds Relay's limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new HotjarApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Hotjar authentication returned HTTP ${response.status}.`,
        response.status,
      );
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof (data as JsonObject).access_token !== "string"
    )
      throw new HotjarApiError(
        "provider_validation_error",
        "Hotjar returned an invalid access token response.",
        502,
      );
    const token = (data as JsonObject).access_token as string;
    if (!token || token.length > 16_000 || /[\r\n]/.test(token))
      throw new HotjarApiError(
        "provider_validation_error",
        "Hotjar returned an invalid access token.",
        502,
      );
    return token;
  }

  private async request(
    token: string,
    target: string,
    query: Record<string, string | number>,
  ) {
    const root = new URL("https://api.hotjar.io/v1/");
    const url = new URL(target, root);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new HotjarApiError(
        "policy_blocked",
        "Hotjar requests must stay on the HTTPS API v1 route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new HotjarApiError(
        "provider_unavailable",
        "Hotjar could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Hotjar response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new HotjarApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Hotjar returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private minimizeSurveys(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    return {
      ...body,
      results: this.pickList(body.results, [
        "id",
        "created_time",
        "updated_time",
        "is_enabled",
        "name",
        "type",
        "sentiment_analysis_enabled",
      ]),
    };
  }

  private minimizeSurvey(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const survey = value as JsonObject;
    return Object.fromEntries(
      [
        "id",
        "created_time",
        "updated_time",
        "is_enabled",
        "name",
        "type",
        "questions",
        "sentiment_analysis_enabled",
      ]
        .filter((key) => survey[key] !== undefined)
        .map((key) => [key, survey[key]]),
    );
  }

  private minimizeResponses(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    return {
      ...body,
      results: this.pickList(body.results, [
        "id",
        "answers",
        "created_time",
        "device",
        "is_complete",
      ]),
    };
  }

  private pickList(value: unknown, keys: string[]) {
    if (!Array.isArray(value)) return [];
    return value
      .slice(0, 25)
      .map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(
              keys
                .filter((key) => (item as JsonObject)[key] !== undefined)
                .map((key) => [key, (item as JsonObject)[key]]),
            )
          : null,
      );
  }

  private requireCredentials(credentials: HotjarCredentials) {
    if (
      ![credentials.clientId, credentials.clientSecret].every(
        (value) => value && value.length <= 16_000 && !/[\r\n]/.test(value),
      ) ||
      !/^\d{1,20}$/.test(credentials.siteId)
    )
      throw new HotjarApiError(
        "credential_missing",
        "Valid Hotjar client credentials and numeric site ID are required.",
        401,
      );
  }

  private surveyId(value: unknown) {
    const text = String(value ?? "");
    if (!/^survey_[0-9a-f-]{36}$/i.test(text))
      throw this.invalid("surveyId must be a Hotjar survey identifier.");
    return text;
  }

  private cursor(value: unknown) {
    if (value === undefined) return {};
    const text = String(value);
    if (!text || text.length > 4096 || !/^[A-Za-z0-9._~-]+$/.test(text))
      throw this.invalid("cursor is invalid.");
    return { cursor: text };
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

  private requireOnly(input: HotjarOperationInput, allowed: readonly string[]) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "Hotjar input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: HotjarOperationInput) {
    const allowed = new Set(["limit", "cursor", "surveyId"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new HotjarApiError(
        "policy_blocked",
        "Hotjar accepts only pinned operation inputs.",
        403,
      );
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { msg: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 25).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|client.?secret|api.?key)/i.test(
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
    const candidate = body.msg ?? body.message ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new HotjarApiError("provider_validation_error", message, 400);
  }
}
