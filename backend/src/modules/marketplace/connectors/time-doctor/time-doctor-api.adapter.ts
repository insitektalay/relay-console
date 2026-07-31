import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  TIME_DOCTOR_OPERATION_BY_ID,
  type TimeDoctorOperation,
} from "./time-doctor-operation-registry";

type JsonObject = Record<string, unknown>;
export type TimeDoctorCredentials = { jwtToken: string };
export type TimeDoctorOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
};

export class TimeDoctorApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TimeDoctorApiAdapter {
  private static readonly ORIGIN = "https://api2.timedoctor.com";

  health(credentials: TimeDoctorCredentials) {
    return this.directRequest(credentials, "/api/1.0/companies", "GET");
  }

  read(
    credentials: TimeDoctorCredentials,
    operationId: string,
    input: TimeDoctorOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("Time Doctor read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: TimeDoctorCredentials,
    operationId: string,
    input: TimeDoctorOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid(
        "Time Doctor manage accepts mutation operations only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: TimeDoctorCredentials,
    operation: TimeDoctorOperation,
    input: TimeDoctorOperationInput,
  ) {
    this.rejectCredentialFields(input);
    let path = operation.path;
    const pathParameters = input.pathParameters ?? {};
    this.exactKeys(pathParameters, operation.pathParameters, "path");
    for (const name of operation.pathParameters) {
      path = path.replaceAll(
        `{${name}}`,
        encodeURIComponent(this.segment(pathParameters[name], name)),
      );
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://")) {
      throw new TimeDoctorApiError(
        "policy_blocked",
        "Time Doctor path escaped the pinned public API route.",
        403,
      );
    }
    const url = new URL(path, TimeDoctorApiAdapter.ORIGIN);
    const query = input.query ?? {};
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`Time Doctor query ${name} has too many values.`);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        url.searchParams.append(name, this.scalar(item, name));
      }
    }
    for (const paginationName of ["limit", "pageSize", "page_size"]) {
      const value = url.searchParams.get(paginationName);
      if (
        value &&
        (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 500)
      ) {
        throw this.invalid(
          `Time Doctor ${paginationName} must be an integer from 1 through 500.`,
        );
      }
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid(
        "This Time Doctor operation does not accept a JSON body.",
      );
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("Time Doctor request exceeds the 2 MB Relay limit.");
    return this.directRequest(
      credentials,
      `${url.pathname}${url.search}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    credentials: TimeDoctorCredentials,
    target: string,
    method: string,
    body?: string,
  ) {
    this.requireCredentials(credentials);
    const url = new URL(target, TimeDoctorApiAdapter.ORIGIN);
    if (
      url.origin !== TimeDoctorApiAdapter.ORIGIN ||
      url.protocol !== "https:" ||
      !/^\/api\/(?:1\.0|1\.1|v1)\//.test(url.pathname)
    ) {
      throw new TimeDoctorApiError(
        "policy_blocked",
        "Time Doctor requests must stay on the fixed HTTPS API origin and pinned API versions.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `JWT ${credentials.jwtToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof TimeDoctorApiError) throw error;
      throw new TimeDoctorApiError(
        "provider_unavailable",
        "Time Doctor could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid(
        "Time Doctor response exceeds the 2.5 MB Relay limit.",
      );
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new TimeDoctorApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Time Doctor returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private operation(id: string) {
    const operation = TIME_DOCTOR_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "Time Doctor operation is not in the pinned official OpenAPI contract.",
      );
    return operation;
  }

  private exactKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    for (const key of Object.keys(value))
      if (!allowed.includes(key))
        throw this.invalid(
          `Time Doctor ${label} parameter ${key} is not allowed for this operation.`,
        );
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(text))
      throw this.invalid(`Time Doctor ${name} path parameter is invalid.`);
    return text;
  }

  private scalar(value: unknown, name: string) {
    if (typeof value === "object")
      throw this.invalid(
        `Time Doctor query ${name} must be a scalar or scalar array.`,
      );
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text))
      throw this.invalid(`Time Doctor query ${name} is invalid.`);
    return text;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10)
      throw new TimeDoctorApiError(
        "policy_blocked",
        "Time Doctor request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url)/i.test(
          key,
        )
      )
        throw new TimeDoctorApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private requireCredentials(credentials: TimeDoctorCredentials) {
    if (
      !credentials.jwtToken ||
      credentials.jwtToken.length < 16 ||
      credentials.jwtToken.length > 16_000 ||
      /[\r\n]/.test(credentials.jwtToken)
    )
      throw new TimeDoctorApiError(
        "credential_missing",
        "A valid Time Doctor API token is required.",
        401,
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
    if (depth > 10) return "[truncated]";
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
    const candidate = body.error ?? body.message ?? body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new TimeDoctorApiError("provider_validation_error", message);
  }
}
