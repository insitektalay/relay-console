import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "DELETE";
const API_VERSION = "2026-05-20";
const ID = "[A-Za-z0-9_-]{1,100}";
const KEY = "[A-Za-z0-9_.:-]{1,200}";
const GET_ROUTES = [
  /^\/v2\/bookings$/,
  /^\/v2\/bookings\/business-booking-profile$/,
  /^\/v2\/bookings\/location-booking-profiles$/,
  new RegExp(`^/v2/bookings/location-booking-profiles/${ID}$`),
  /^\/v2\/bookings\/team-member-booking-profiles$/,
  new RegExp(`^/v2/bookings/team-member-booking-profiles/${ID}$`),
  /^\/v2\/bookings\/custom-attribute-definitions$/,
  new RegExp(`^/v2/bookings/custom-attribute-definitions/${KEY}$`),
  new RegExp(`^/v2/bookings/${ID}$`),
  new RegExp(`^/v2/bookings/${ID}/custom-attributes$`),
  new RegExp(`^/v2/bookings/${ID}/custom-attributes/${KEY}$`),
];
const READ_POST_ROUTES = [
  /^\/v2\/bookings\/availability\/search$/,
  /^\/v2\/bookings\/bulk-retrieve$/,
  /^\/v2\/bookings\/team-member-booking-profiles\/bulk-retrieve$/,
];
const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/v2\/bookings$/],
  ["PUT", new RegExp(`^/v2/bookings/${ID}$`)],
  ["POST", new RegExp(`^/v2/bookings/${ID}/cancel$`)],
  ["POST", /^\/v2\/bookings\/custom-attribute-definitions$/],
  ["PUT", new RegExp(`^/v2/bookings/custom-attribute-definitions/${KEY}$`)],
  ["DELETE", new RegExp(`^/v2/bookings/custom-attribute-definitions/${KEY}$`)],
  ["POST", /^\/v2\/bookings\/custom-attributes\/bulk-delete$/],
  ["POST", /^\/v2\/bookings\/custom-attributes\/bulk-upsert$/],
  ["PUT", new RegExp(`^/v2/bookings/${ID}/custom-attributes/${KEY}$`)],
  ["DELETE", new RegExp(`^/v2/bookings/${ID}/custom-attributes/${KEY}$`)],
];

export class SquareAppointmentsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SquareAppointmentsApiAdapter {
  health(accessToken: string) {
    return this.request(accessToken, {
      method: "GET",
      path: "/v2/bookings/business-booking-profile",
    });
  }
  read(accessToken: string, input: JsonObject) {
    const method = (
      this.optional(input.method, "method", 10) ?? "GET"
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (
      !(
        (method === "GET" && this.matches(GET_ROUTES, path)) ||
        (method === "POST" && this.matches(READ_POST_ROUTES, path))
      )
    )
      throw this.validation(
        "Square Appointments read endpoint is not supported.",
      );
    return this.request(accessToken, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }
  manage(accessToken: string, input: JsonObject) {
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
    )
      throw this.validation(
        "Square Appointments mutation endpoint is not supported.",
      );
    return this.request(accessToken, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }
  private async request(
    accessTokenValue: string,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const accessToken = accessTokenValue?.trim();
    if (!accessToken || accessToken.length > 10_000)
      throw new SquareAppointmentsApiError(
        "credential_missing",
        "Square OAuth access token is required.",
        401,
      );
    const permitted =
      (input.method === "GET" && this.matches(GET_ROUTES, input.path)) ||
      (input.method === "POST" && this.matches(READ_POST_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted)
      throw this.validation("Square Appointments endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://connect.squareup.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": API_VERSION,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Square Appointments request exceeds 2 MB.");
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
      if (raw.byteLength > 5_000_000)
        throw this.validation("Square Appointments response exceeds 5 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new SquareAppointmentsApiError(
          this.code(response.status),
          this.message(data) ?? `Square returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof SquareAppointmentsApiError) throw error;
      throw new SquareAppointmentsApiError(
        "provider_unavailable",
        "Square could not be reached.",
        502,
      );
    }
  }
  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }
  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 30)
      throw this.validation("Square Appointments query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\]-]{1,100}$/.test(key))
        throw this.validation("Square Appointments query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Square Appointments query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Square Appointments query value is invalid.");
        params.append(key, String(child).slice(0, 10_000));
      }
    }
  }
  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }
  private optional(value: unknown, label: string, max: number) {
    if (value == null || value === "") return null;
    return this.required(value, label, max);
  }
  private required(value: unknown, label: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`Square Appointments ${label} is invalid.`);
    return value.trim();
  }
  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new SquareAppointmentsApiError(
          "policy_blocked",
          "Square Appointments request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 1000)
          throw new SquareAppointmentsApiError(
            "policy_blocked",
            "Square Appointments request array is too large.",
          );
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000)
        throw new SquareAppointmentsApiError(
          "policy_blocked",
          "Square Appointments request object is too large.",
        );
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new SquareAppointmentsApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const errors = Array.isArray(object?.errors) ? object.errors : [];
    const first =
      errors[0] && typeof errors[0] === "object"
        ? (errors[0] as JsonObject)
        : null;
    const candidate =
      first?.detail ?? first?.code ?? object?.message ?? object?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 400 && status < 500) return "provider_validation_error";
    return "provider_unavailable";
  }
  private validation(message: string) {
    return new SquareAppointmentsApiError(
      "provider_validation_error",
      message,
      400,
    );
  }
}
