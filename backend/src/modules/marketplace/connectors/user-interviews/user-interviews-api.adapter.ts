import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type UserInterviewsCredentials = { apiKey: string };
export type UserInterviewsOperationInput = {
  page?: unknown;
  limit?: unknown;
  recruitId?: unknown;
};
export const USER_INTERVIEWS_READ_OPERATIONS = [
  "characteristics.list",
  "recruits.list",
  "recruit.get",
] as const;

export class UserInterviewsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class UserInterviewsApiAdapter {
  health(credentials: UserInterviewsCredentials) {
    return this.read(credentials, "characteristics.list", { limit: 1 });
  }

  read(
    credentials: UserInterviewsCredentials,
    operation: string,
    input: UserInterviewsOperationInput,
  ) {
    this.requireCredentials(credentials);
    this.rejectUnknownInput(input);
    if (!USER_INTERVIEWS_READ_OPERATIONS.includes(operation as never))
      throw this.invalid(
        "User Interviews operation is outside Relay's pinned read-only contract.",
      );
    if (operation === "recruit.get") {
      this.requireOnly(input, ["recruitId"]);
      return this.request(
        credentials,
        `recruits/${encodeURIComponent(this.identifier(input.recruitId))}`,
        {},
      );
    }
    this.requireOnly(input, ["page", "limit"]);
    const query: Record<string, string | number> = {
      "page[number]": this.integer(input.page, "page", 1, 10_000, 1),
      "page[size]": this.integer(input.limit, "limit", 1, 25, 20),
    };
    if (operation === "characteristics.list")
      query["fields[characteristic]"] = "createdAt,name,slug,type,updatedAt";
    return this.request(
      credentials,
      operation === "characteristics.list" ? "characteristics" : "recruits",
      query,
    );
  }

  private async request(
    credentials: UserInterviewsCredentials,
    target: string,
    query: Record<string, string | number>,
  ) {
    const root = new URL("https://www.userinterviews.com/api/");
    const url = new URL(target, root);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new UserInterviewsApiError(
        "policy_blocked",
        "User Interviews requests must stay on the HTTPS API route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.user-interviews.v2+json",
          "Content-Type": "application/json",
          "user-interviews-apikey": credentials.apiKey,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new UserInterviewsApiError(
        "provider_unavailable",
        "User Interviews could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid(
        "User Interviews response exceeds Relay's 2.5 MB limit.",
      );
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new UserInterviewsApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `User Interviews returned HTTP ${response.status}.`,
        response.status,
      );
    return target === "characteristics"
      ? this.minimizeCharacteristics(data)
      : this.minimizeRecruits(data);
  }

  private minimizeCharacteristics(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    return {
      data: this.resources(body.data, [
        "createdAt",
        "name",
        "slug",
        "type",
        "updatedAt",
      ]),
      meta: body.meta,
    };
  }

  private minimizeRecruits(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    if (Array.isArray(body.data))
      return {
        data: this.resources(body.data, [
          "createdAt",
          "internalName",
          "publicTitle",
          "status",
          "numParticipants",
          "compensationAmount",
          "requireApproval",
          "studyType",
          "updatedAt",
        ]),
        meta: body.meta,
      };
    return {
      data: this.resource(body.data, [
        "createdAt",
        "internalName",
        "publicTitle",
        "status",
        "numParticipants",
        "compensationAmount",
        "requireApproval",
        "studyType",
        "updatedAt",
      ]),
    };
  }

  private resources(value: unknown, attributes: string[]) {
    return Array.isArray(value)
      ? value.slice(0, 25).map((item) => this.resource(item, attributes))
      : [];
  }
  private resource(value: unknown, attributes: string[]) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const item = value as JsonObject;
    const rawAttributes =
      item.attributes &&
      typeof item.attributes === "object" &&
      !Array.isArray(item.attributes)
        ? (item.attributes as JsonObject)
        : {};
    return {
      ...Object.fromEntries(
        ["id", "type"]
          .filter((key) => item[key] !== undefined)
          .map((key) => [key, item[key]]),
      ),
      attributes: Object.fromEntries(
        attributes
          .filter((key) => rawAttributes[key] !== undefined)
          .map((key) => [key, rawAttributes[key]]),
      ),
    };
  }

  private requireCredentials(credentials: UserInterviewsCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new UserInterviewsApiError(
        "credential_missing",
        "A valid User Interviews API key is required.",
        401,
      );
  }
  private identifier(value: unknown) {
    const text = String(value ?? "");
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(text))
      throw this.invalid("recruitId is invalid.");
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
    input: UserInterviewsOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "User Interviews input contains fields unsupported by the selected operation.",
      );
  }
  private rejectUnknownInput(input: UserInterviewsOperationInput) {
    const allowed = new Set(["page", "limit", "recruitId"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new UserInterviewsApiError(
        "policy_blocked",
        "User Interviews accepts only pinned operation inputs.",
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
          /(token|secret|authorization|password|cookie|credential|api.?key|webhook.?url|task.?url|availability.?url)/i.test(
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
    return new UserInterviewsApiError(
      "provider_validation_error",
      message,
      400,
    );
  }
}
