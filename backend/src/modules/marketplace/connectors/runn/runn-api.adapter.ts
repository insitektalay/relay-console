import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  RUNN_OPERATION_BY_ID,
  type RunnOperation,
} from "./runn-operation-registry";

type JsonObject = Record<string, unknown>;
export type RunnCredentials = {
  apiToken: string;
  apiOrigin: "https://api.runn.io" | "https://api.us.runn.io";
};
export type RunnOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
};

export class RunnApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RunnApiAdapter {
  health(credentials: RunnCredentials) {
    return this.directRequest(credentials, "/me", "GET");
  }

  read(
    credentials: RunnCredentials,
    operationId: string,
    input: RunnOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("Runn read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: RunnCredentials,
    operationId: string,
    input: RunnOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid("Runn manage accepts mutation operations only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: RunnCredentials,
    operation: RunnOperation,
    input: RunnOperationInput,
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
      throw new RunnApiError(
        "policy_blocked",
        "Runn path escaped the pinned public API route.",
        403,
      );
    }
    const url = new URL(path, credentials.apiOrigin);
    const query = input.query ?? {};
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`Runn query ${name} has too many values.`);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        url.searchParams.append(name, this.scalar(item, name));
      }
    }
    const limit = url.searchParams.get("limit");
    if (
      limit &&
      (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 200)
    ) {
      throw this.invalid("Runn limit must be an integer from 1 through 200.");
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid("This Runn operation does not accept a JSON body.");
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("Runn request exceeds the 2 MB Relay limit.");
    return this.directRequest(
      credentials,
      `${url.pathname}${url.search}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    credentials: RunnCredentials,
    target: string,
    method: string,
    body?: string,
  ) {
    this.requireCredentials(credentials);
    const url = new URL(target, credentials.apiOrigin);
    if (url.origin !== credentials.apiOrigin || url.protocol !== "https:") {
      throw new RunnApiError(
        "policy_blocked",
        "Runn requests must stay on the selected fixed HTTPS API origin.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Accept-Version": "1.0.0",
          Authorization: `Bearer ${credentials.apiToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof RunnApiError) throw error;
      throw new RunnApiError(
        "provider_unavailable",
        "Runn could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Runn response exceeds the 2.5 MB Relay limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new RunnApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Runn returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private operation(id: string) {
    const operation = RUNN_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "Runn operation is not in the pinned official OpenAPI contract.",
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
          `Runn ${label} parameter ${key} is not allowed for this operation.`,
        );
  }
  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(text))
      throw this.invalid(`Runn ${name} path parameter is invalid.`);
    return text;
  }
  private scalar(value: unknown, name: string) {
    if (typeof value === "object")
      throw this.invalid(
        `Runn query ${name} must be a scalar or scalar array.`,
      );
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text))
      throw this.invalid(`Runn query ${name} is invalid.`);
    return text;
  }
  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10)
      throw new RunnApiError(
        "policy_blocked",
        "Runn request is too deeply nested.",
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
        throw new RunnApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }
  private requireCredentials(credentials: RunnCredentials) {
    if (
      !credentials.apiToken ||
      credentials.apiToken.length > 8_000 ||
      /[\r\n]/.test(credentials.apiToken)
    )
      throw new RunnApiError(
        "credential_missing",
        "A valid Runn API token is required.",
        401,
      );
    if (
      !["https://api.runn.io", "https://api.us.runn.io"].includes(
        credentials.apiOrigin,
      )
    )
      throw new RunnApiError(
        "policy_blocked",
        "Runn API origin must be the documented EU or US endpoint.",
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
    return new RunnApiError("provider_validation_error", message);
  }
}
