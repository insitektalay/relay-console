import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  RESOURCE_GURU_OPERATION_BY_ID,
  type ResourceGuruOperation,
} from "./resource-guru-operation-registry";

type JsonObject = Record<string, unknown>;
export type ResourceGuruOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
};

export class ResourceGuruApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ResourceGuruApiAdapter {
  health(accessToken: string) {
    return this.directRequest(accessToken, "/v1/me", "GET");
  }

  read(
    accessToken: string,
    operationId: string,
    input: ResourceGuruOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("Resource Guru read accepts GET operations only.");
    return this.request(accessToken, operation, input);
  }

  manage(
    accessToken: string,
    operationId: string,
    input: ResourceGuruOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid(
        "Resource Guru manage accepts mutation operations only.",
      );
    return this.request(accessToken, operation, input);
  }

  private async request(
    accessToken: string,
    operation: ResourceGuruOperation,
    input: ResourceGuruOperationInput,
  ) {
    this.rejectCredentialFields(input);
    let path = operation.path;
    const pathParameters = input.pathParameters ?? {};
    this.exactKeys(pathParameters, operation.pathParameters, "path");
    for (const name of operation.pathParameters) {
      const value = this.segment(
        pathParameters[name],
        name,
        name === "account",
      );
      path = path.replaceAll(`{${name}}`, encodeURIComponent(value));
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://")) {
      throw new ResourceGuruApiError(
        "policy_blocked",
        "Resource Guru path escaped the pinned public API route.",
        403,
      );
    }
    const url = new URL(path, "https://api.resourceguruapp.com");
    const query = input.query ?? {};
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`Resource Guru query ${name} has too many values.`);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        const value = this.scalar(item, name);
        url.searchParams.append(name, value);
      }
    }
    for (const key of ["limit", "per_page", "page_size"]) {
      const value = url.searchParams.get(key);
      if (value && (!/^\d+$/.test(value) || Number(value) > 500)) {
        throw this.invalid(
          `Resource Guru ${key} must be an integer from 1 through 500.`,
        );
      }
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid(
        "This Resource Guru operation does not accept a JSON body.",
      );
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("Resource Guru request exceeds the 2 MB Relay limit.");
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
      throw new ResourceGuruApiError(
        "credential_missing",
        "A valid Resource Guru OAuth token is required.",
        401,
      );
    }
    const url = new URL(target, "https://api.resourceguruapp.com");
    if (
      url.origin !== "https://api.resourceguruapp.com" ||
      !url.pathname.startsWith("/v1/")
    ) {
      throw new ResourceGuruApiError(
        "policy_blocked",
        "Resource Guru requests must stay on the fixed HTTPS v1 API origin.",
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
    } catch (error) {
      if (error instanceof ResourceGuruApiError) throw error;
      throw new ResourceGuruApiError(
        "provider_unavailable",
        "Resource Guru could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid(
        "Resource Guru response exceeds the 2.5 MB Relay limit.",
      );
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new ResourceGuruApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Resource Guru returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private operation(id: string) {
    const operation = RESOURCE_GURU_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "Resource Guru operation is not in the pinned official OpenAPI contract.",
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
          `Resource Guru ${label} parameter ${key} is not allowed for this operation.`,
        );
  }
  private segment(value: unknown, name: string, account = false) {
    const text = String(value ?? "").trim();
    const pattern = account
      ? /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/
      : /^[A-Za-z0-9_.:-]{1,200}$/;
    if (!pattern.test(text))
      throw this.invalid(`Resource Guru ${name} path parameter is invalid.`);
    return text;
  }
  private scalar(value: unknown, name: string) {
    if (typeof value === "object")
      throw this.invalid(
        `Resource Guru query ${name} must be a scalar or scalar array.`,
      );
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text))
      throw this.invalid(`Resource Guru query ${name} is invalid.`);
    return text;
  }
  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10)
      throw new ResourceGuruApiError(
        "policy_blocked",
        "Resource Guru request is too deeply nested.",
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
        throw new ResourceGuruApiError(
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
    return new ResourceGuruApiError("provider_validation_error", message);
  }
}
