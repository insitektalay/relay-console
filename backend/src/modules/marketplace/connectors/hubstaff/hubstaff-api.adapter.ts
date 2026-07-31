import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  HUBSTAFF_OPERATION_BY_ID,
  type HubstaffOperation,
} from "./hubstaff-operation-registry";

type JsonObject = Record<string, unknown>;
export type HubstaffOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
};

export class HubstaffApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HubstaffApiAdapter {
  private static readonly ORIGIN = "https://api.hubstaff.com";

  health(accessToken: string) {
    return this.directRequest(accessToken, "/v2/users/me", "GET");
  }

  read(
    accessToken: string,
    operationId: string,
    input: HubstaffOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("Hubstaff read accepts GET operations only.");
    return this.request(accessToken, operation, input);
  }

  manage(
    accessToken: string,
    operationId: string,
    input: HubstaffOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid("Hubstaff manage accepts mutation operations only.");
    return this.request(accessToken, operation, input);
  }

  private async request(
    accessToken: string,
    operation: HubstaffOperation,
    input: HubstaffOperationInput,
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
      throw new HubstaffApiError(
        "policy_blocked",
        "Hubstaff path escaped the pinned v2 API route.",
        403,
      );
    }
    const url = new URL(path, HubstaffApiAdapter.ORIGIN);
    const query = input.query ?? {};
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`Hubstaff query ${name} has too many values.`);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        url.searchParams.append(name, this.scalar(item, name));
      }
    }
    for (const name of ["page_limit", "limit", "per_page"]) {
      const value = url.searchParams.get(name);
      if (
        value &&
        (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 500)
      ) {
        throw this.invalid(
          `Hubstaff ${name} must be an integer from 1 through 500.`,
        );
      }
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid(
        "This Hubstaff operation does not accept a JSON body.",
      );
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("Hubstaff request exceeds the 2 MB Relay limit.");
    return this.directRequest(
      accessToken,
      `${url.pathname}${url.search}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    accessToken: string,
    target: string,
    method: string,
    body?: string,
  ) {
    if (
      !accessToken ||
      accessToken.length > 8_000 ||
      /[\r\n]/.test(accessToken)
    ) {
      throw new HubstaffApiError(
        "credential_missing",
        "A valid Hubstaff OAuth token is required.",
        401,
      );
    }
    const url = new URL(target, HubstaffApiAdapter.ORIGIN);
    if (
      url.origin !== HubstaffApiAdapter.ORIGIN ||
      !url.pathname.startsWith("/v2/") ||
      url.pathname === "/v2/docs"
    ) {
      throw new HubstaffApiError(
        "policy_blocked",
        "Hubstaff requests must stay on the fixed HTTPS v2 API origin.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch {
      throw new HubstaffApiError(
        "provider_unavailable",
        "Hubstaff could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Hubstaff response exceeds the 2.5 MB Relay limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new HubstaffApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Hubstaff returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  private operation(id: string) {
    const operation = HUBSTAFF_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "Hubstaff operation is not in the pinned official v2 API contract.",
      );
    return operation;
  }

  private exactKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key))
        throw this.invalid(
          `Hubstaff ${label} parameter ${key} is not allowed for this operation.`,
        );
    }
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(text))
      throw this.invalid(`Hubstaff ${name} path parameter is invalid.`);
    return text;
  }

  private scalar(value: unknown, name: string) {
    if (typeof value === "object")
      throw this.invalid(
        `Hubstaff query ${name} must be a scalar or scalar array.`,
      );
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text))
      throw this.invalid(`Hubstaff query ${name} is invalid.`);
    return text;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10)
      throw new HubstaffApiError(
        "policy_blocked",
        "Hubstaff request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new HubstaffApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      }
      this.rejectCredentialFields(item, depth + 1);
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
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject).map(([key, item]) => [
        key,
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
          ? "[redacted]"
          : this.redact(item, depth + 1),
      ]),
    );
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const object = value as JsonObject;
    for (const key of ["message", "error", "detail"]) {
      if (typeof object[key] === "string")
        return String(object[key]).slice(0, 500);
    }
    return null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }

  private invalid(message: string) {
    return new HubstaffApiError("provider_validation_error", message, 400);
  }
}
