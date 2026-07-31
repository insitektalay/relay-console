import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type JsonBody = JsonObject | unknown[];
type Method = "GET" | "POST" | "PATCH" | "DELETE";
export type ReallySimpleSystemsCredentials = { accessToken: string };

const RESOURCE =
  "(?:accounts|activities|contacts|campaigns|campaigndetails|campaignstages|cases|documents|opportunities|opportunityhistories|opportunity_lines)";
const ID = "[0-9]{1,20}";
const FIELD = "[A-Za-z0-9_.-]{1,200}";
const LOOKUP = "[A-Za-z0-9_.-]{1,200}";

const READ_ROUTES = [
  new RegExp(`^/${RESOURCE}$`),
  new RegExp(`^/${RESOURCE}/${ID}$`),
  new RegExp(`^/datadictionary/${RESOURCE}$`),
  new RegExp(`^/lookup/${RESOURCE}/${FIELD}$`),
];

const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", new RegExp(`^/${RESOURCE}$`)],
  ["PATCH", new RegExp(`^/${RESOURCE}/${ID}$`)],
  ["DELETE", new RegExp(`^/${RESOURCE}/${ID}$`)],
  ["PATCH", new RegExp(`^/lookup/${LOOKUP}$`)],
];

export class ReallySimpleSystemsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ReallySimpleSystemsApiAdapter {
  async health(credentials: ReallySimpleSystemsCredentials) {
    const accountProbe = await this.request(credentials, {
      method: "GET",
      path: "/accounts",
      query: { limit: 1, page: 1 },
    });
    return { tokenVerified: true, apiVersion: "v4", accountProbe };
  }

  read(credentials: ReallySimpleSystemsCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_ROUTES, path)) {
      throw this.validation("Spotler CRM read endpoint is not supported.");
    }
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: ReallySimpleSystemsCredentials, input: JsonObject) {
    const method = this.required(
      input.method,
      "method",
      10,
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (
      !MANAGE_ROUTES.some(
        ([allowed, pattern]) => allowed === method && pattern.test(path),
      )
    ) {
      throw this.validation("Spotler CRM mutation endpoint is not supported.");
    }
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.body(input.json),
    });
  }

  private async request(
    credentials: ReallySimpleSystemsCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonBody;
    },
  ) {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken || accessToken.length > 10_000) {
      throw new ReallySimpleSystemsApiError(
        "credential_missing",
        "Spotler CRM V4 access token is required.",
        401,
      );
    }
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted) throw this.validation("Spotler CRM endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);

    const url = new URL(`https://apiv4.reallysimplesystems.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000) {
        throw this.validation("Spotler CRM request exceeds 1 MB.");
      }
    }

    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000) {
        throw this.validation("Spotler CRM response exceeds 5 MB.");
      }
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new ReallySimpleSystemsApiError(
          this.code(response.status),
          this.message(data) ?? `Spotler CRM returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof ReallySimpleSystemsApiError) throw error;
      throw new ReallySimpleSystemsApiError(
        "provider_unavailable",
        "Spotler CRM could not be reached.",
        502,
      );
    }
  }

  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    const entries = Object.entries(value);
    if (entries.length > 5) {
      throw this.validation("Spotler CRM query has too many fields.");
    }
    for (const [key, item] of entries) {
      if (!/^(?:limit|page|lines|q|order)$/.test(key)) {
        throw this.validation("Spotler CRM query field is not supported.");
      }
      if (!["string", "number", "boolean"].includes(typeof item)) {
        throw this.validation("Spotler CRM query value is invalid.");
      }
      const text = String(item);
      if (
        key === "limit" &&
        (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 100)
      ) {
        throw this.validation("Spotler CRM limit must be between 1 and 100.");
      }
      if (
        key === "page" &&
        (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 10_000)
      ) {
        throw this.validation("Spotler CRM page must be between 1 and 10000.");
      }
      if (key === "lines" && !/^(?:true|false)$/.test(text)) {
        throw this.validation("Spotler CRM lines must be a boolean.");
      }
      if (key === "q" || key === "order") {
        this.validateJsonQuery(text, key);
      }
      params.append(key, text.slice(0, 10_000));
    }
  }

  private validateJsonQuery(value: string, label: string) {
    if (!value || value.length > 10_000) {
      throw this.validation(`Spotler CRM ${label} query is too large.`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw this.validation(`Spotler CRM ${label} query must be valid JSON.`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw this.validation(
        `Spotler CRM ${label} query must be a JSON object.`,
      );
    }
    this.rejectSecrets(parsed);
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private body(value: unknown): JsonBody | undefined {
    return value && typeof value === "object" ? (value as JsonBody) : undefined;
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 10) {
      throw new ReallySimpleSystemsApiError(
        "policy_blocked",
        "Spotler CRM request is too deeply nested.",
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 1_000) {
        throw new ReallySimpleSystemsApiError(
          "policy_blocked",
          "Spotler CRM request array is too large.",
        );
      }
      value.forEach((child) => this.rejectSecrets(child, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 1_000) {
      throw new ReallySimpleSystemsApiError(
        "policy_blocked",
        "Spotler CRM request object is too large.",
      );
    }
    for (const [key, child] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new ReallySimpleSystemsApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      }
      this.rejectSecrets(child, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object = this.object(value);
    return typeof object?.message === "string"
      ? object.message.slice(0, 500)
      : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 402) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new ReallySimpleSystemsApiError(
      "provider_validation_error",
      message,
    );
  }

  private required(value: unknown, label: string, maxLength: number) {
    if (typeof value !== "string" || !value || value.length > maxLength) {
      throw this.validation(`Spotler CRM ${label} is invalid.`);
    }
    return value;
  }
}
