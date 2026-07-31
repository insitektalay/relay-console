import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type UserTestingCredentials = { clientId: string; clientSecret: string };
export type UserTestingOperationInput = {
  testId?: unknown;
  limit?: unknown;
  offset?: unknown;
};
export const USERTESTING_READ_OPERATIONS = [
  "sessions.list",
  "qxScores.get",
] as const;

export class UserTestingApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class UserTestingApiAdapter {
  health(credentials: UserTestingCredentials) {
    return this.accessToken(credentials).then(() => ({ authenticated: true }));
  }

  async read(
    credentials: UserTestingCredentials,
    operation: string,
    input: UserTestingOperationInput,
  ) {
    this.requireCredentials(credentials);
    this.rejectUnknownInput(input);
    if (!USERTESTING_READ_OPERATIONS.includes(operation as never))
      throw this.invalid(
        "UserTesting operation is outside Relay's pinned read-only contract.",
      );
    const testId = this.uuid(input.testId, "testId");
    let target: string;
    let query: Record<string, string | number> = {};
    if (operation === "sessions.list") {
      this.requireOnly(input, ["testId", "limit", "offset"]);
      target = "api/v2/sessionResults";
      query = {
        testId,
        limit: this.integer(input.limit, "limit", 1, 25, 25),
        offset: this.integer(input.offset, "offset", 0, 10_000, 0),
      };
    } else {
      this.requireOnly(input, ["testId"]);
      target = `api/v2/testResults/${encodeURIComponent(testId)}/qxScores`;
    }
    const token = await this.accessToken(credentials);
    const data = await this.request(token, target, query);
    return operation === "sessions.list"
      ? this.minimizeSessions(data)
      : this.minimizeScores(data);
  }

  private async accessToken(credentials: UserTestingCredentials) {
    this.requireCredentials(credentials);
    let response: Response;
    try {
      response = await safeConnectorFetch(
        "https://auth.usertesting.com/oauth2/aus1p3vtd8vtm4Bxv0h8/v1/token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
          },
          body: new URLSearchParams({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            grant_type: "client_credentials",
            scope: "studies:read",
          }),
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      );
    } catch {
      throw new UserTestingApiError(
        "provider_unavailable",
        "UserTesting authentication could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 250_000)
      throw this.invalid("UserTesting token response exceeds Relay's limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new UserTestingApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `UserTesting authentication returned HTTP ${response.status}.`,
        response.status,
      );
    const token =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as JsonObject).access_token
        : null;
    if (
      typeof token !== "string" ||
      !token ||
      token.length > 16_000 ||
      /[\r\n]/.test(token)
    )
      throw new UserTestingApiError(
        "provider_validation_error",
        "UserTesting returned an invalid access token.",
        502,
      );
    return token;
  }

  private async request(
    token: string,
    target: string,
    query: Record<string, string | number>,
  ) {
    const root = new URL("https://api.use2.usertesting.com/");
    const url = new URL(target, root);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    if (url.origin !== root.origin || !url.pathname.startsWith("/api/v2/"))
      throw new UserTestingApiError(
        "policy_blocked",
        "UserTesting requests must stay on pinned HTTPS Results API v2 routes.",
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
      throw new UserTestingApiError(
        "provider_unavailable",
        "UserTesting could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("UserTesting response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new UserTestingApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `UserTesting returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private minimizeSessions(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    return {
      testId: body.testId,
      sessions: this.pickList(body.sessions, [
        "sessionId",
        "status",
        "startTime",
        "finishTime",
      ]),
      meta: body.meta,
    };
  }

  private minimizeScores(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    return {
      testId: body.testId,
      qxScores: this.pickList(body.qxScores, [
        "taskGroupId",
        "label",
        "qxScore",
        "components",
        "values",
      ]),
      meta: body.meta,
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

  private requireCredentials(credentials: UserTestingCredentials) {
    if (
      ![credentials.clientId, credentials.clientSecret].every(
        (value) => value && value.length <= 16_000 && !/[\r\n]/.test(value),
      )
    )
      throw new UserTestingApiError(
        "credential_missing",
        "Valid UserTesting client credentials are required.",
        401,
      );
  }

  private uuid(value: unknown, name: string) {
    const text = String(value ?? "");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        text,
      )
    )
      throw this.invalid(`${name} must be a UUID.`);
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
    input: UserTestingOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "UserTesting input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: UserTestingOperationInput) {
    const allowed = new Set(["testId", "limit", "offset"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new UserTestingApiError(
        "policy_blocked",
        "UserTesting accepts only pinned operation inputs.",
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
      return value.slice(0, 25).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|client.?secret|signed.?url|video.?url)/i.test(
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
    const candidate = body.message ?? body.error ?? body.detail;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private invalid(message: string) {
    return new UserTestingApiError("provider_validation_error", message, 400);
  }
}
