import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  EVERHOUR_OPERATION_BY_ID,
  type EverhourOperation,
} from "./everhour-operation-registry";

type JsonObject = Record<string, unknown>;
export type EverhourCredentials = { apiKey: string };
export type EverhourOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
};

export class EverhourApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class EverhourApiAdapter {
  health(credentials: EverhourCredentials) {
    return this.directRequest(credentials, "/users/me", "GET");
  }

  read(
    credentials: EverhourCredentials,
    operationId: string,
    input: EverhourOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("Everhour read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: EverhourCredentials,
    operationId: string,
    input: EverhourOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid("Everhour manage accepts mutation operations only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: EverhourCredentials,
    operation: EverhourOperation,
    input: EverhourOperationInput,
  ) {
    this.rejectCredentialFields(input);
    let path = operation.path;
    const pathParameters = input.pathParameters ?? {};
    this.exactKeys(pathParameters, operation.pathParameters, "path");
    for (const name of operation.pathParameters)
      path = path.replaceAll(
        `{${name}}`,
        encodeURIComponent(this.segment(pathParameters[name], name)),
      );
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://"))
      throw new EverhourApiError(
        "policy_blocked",
        "Everhour path escaped the pinned public API route.",
        403,
      );
    const url = new URL(path, "https://api.everhour.com");
    for (const [name, value] of Object.entries(operation.fixedQuery))
      url.searchParams.set(name, value);
    const query = input.query ?? {};
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`Everhour query ${name} has too many values.`);
      if (
        Object.prototype.hasOwnProperty.call(operation.fixedQuery, name) &&
        values.some((value) => String(value) !== operation.fixedQuery[name])
      )
        throw new EverhourApiError(
          "policy_blocked",
          `Everhour fixed query parameter ${name} cannot be changed.`,
          403,
        );
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        url.searchParams.append(name, this.scalar(item, name));
      }
    }
    const limit = url.searchParams.get("limit");
    if (
      limit &&
      (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)
    )
      throw this.invalid(
        "Everhour limit must be an integer from 1 through 100.",
      );
    const page = url.searchParams.get("page");
    if (page && (!/^\d+$/.test(page) || Number(page) > 10_000))
      throw this.invalid(
        "Everhour page must be an integer from 0 through 10,000.",
      );
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid(
        "This Everhour operation does not accept a JSON body.",
      );
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("Everhour request exceeds the 2 MB Relay limit.");
    return this.directRequest(
      credentials,
      `${url.pathname}${url.search}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    credentials: EverhourCredentials,
    target: string,
    method: string,
    body?: string,
  ) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 8_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new EverhourApiError(
        "credential_missing",
        "A valid Everhour API key is required.",
        401,
      );
    const url = new URL(target, "https://api.everhour.com");
    if (url.origin !== "https://api.everhour.com")
      throw new EverhourApiError(
        "policy_blocked",
        "Everhour requests must stay on the fixed HTTPS API origin.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "X-Accept-Version": "1.2",
          "X-Api-Key": credentials.apiKey,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof EverhourApiError) throw error;
      throw new EverhourApiError(
        "provider_unavailable",
        "Everhour could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Everhour response exceeds the 2.5 MB Relay limit.");
    const contentType =
      response.headers.get("content-type") ?? "application/octet-stream";
    const data = /json/i.test(contentType)
      ? this.redact(this.parse(raw))
      : raw.byteLength > 1_500_000
        ? (() => {
            throw this.invalid(
              "Everhour binary response exceeds the 1.5 MB Relay limit.",
            );
          })()
        : {
            contentType: contentType.slice(0, 200),
            dataBase64: raw.toString("base64"),
          };
    if (!response.ok)
      throw new EverhourApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Everhour returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private operation(id: string) {
    const operation = EVERHOUR_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "Everhour operation is not in the pinned official API Blueprint contract.",
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
          `Everhour ${label} parameter ${key} is not allowed for this operation.`,
        );
  }
  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(text))
      throw this.invalid(`Everhour ${name} path parameter is invalid.`);
    return text;
  }
  private scalar(value: unknown, name: string) {
    if (typeof value === "object")
      throw this.invalid(
        `Everhour query ${name} must be a scalar or scalar array.`,
      );
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text))
      throw this.invalid(`Everhour query ${name} is invalid.`);
    return text;
  }
  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10)
      throw new EverhourApiError(
        "policy_blocked",
        "Everhour request is too deeply nested.",
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
      )
        throw new EverhourApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
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
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
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
    return new EverhourApiError("provider_validation_error", message);
  }
}
