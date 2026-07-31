import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  DEPUTY_OPERATION_BY_ID,
  DEPUTY_READ_OPERATION_IDS,
  DEPUTY_WRITE_OPERATION_IDS,
  type DeputyOperation,
} from "./deputy-operation-registry";

type JsonObject = Record<string, unknown>;
export type DeputyOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  headers?: JsonObject;
  body?: JsonObject;
  contentBase64?: string;
  fileName?: string;
  mimeType?: string;
};

export class DeputyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DeputyApiAdapter {
  getCurrentUser(accessToken: string, apiOrigin: string) {
    return this.directRequest(accessToken, apiOrigin, "/api/v1/me", "GET");
  }

  read(
    accessToken: string,
    apiOrigin: string,
    operationId: string,
    input: DeputyOperationInput,
  ) {
    this.assertGroup(operationId, DEPUTY_READ_OPERATION_IDS, "read");
    return this.request(accessToken, apiOrigin, operationId, input);
  }

  manage(
    accessToken: string,
    apiOrigin: string,
    operationId: string,
    input: DeputyOperationInput,
  ) {
    this.assertGroup(operationId, DEPUTY_WRITE_OPERATION_IDS, "mutation");
    return this.request(accessToken, apiOrigin, operationId, input);
  }

  normalizeApiOrigin(value: string) {
    const raw = value.trim().match(/^https?:\/\//i)
      ? value.trim()
      : `https://${value.trim()}`;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new DeputyApiError(
        "provider_validation_error",
        "Deputy install authority is invalid.",
      );
    }
    const labels = url.hostname.toLowerCase().split(".");
    const install = labels[0];
    const geo = labels[1];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      labels.length !== 4 ||
      labels[2] !== "deputy" ||
      labels[3] !== "com" ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(install) ||
      !["au", "eu", "uk", "us"].includes(geo)
    ) {
      throw new DeputyApiError(
        "policy_blocked",
        "Deputy install authority must be an OAuth-returned HTTPS install in a documented Deputy region.",
      );
    }
    return `https://${url.hostname.toLowerCase()}`;
  }

  private async request(
    accessToken: string,
    apiOriginValue: string,
    operationId: string,
    input: DeputyOperationInput,
  ) {
    const operation = DEPUTY_OPERATION_BY_ID.get(operationId);
    if (!operation) {
      throw new DeputyApiError(
        "provider_validation_error",
        "Deputy operation is not in the pinned official documentation.",
      );
    }
    this.rejectCredentialFields(input);
    const bodyBytes = Buffer.byteLength(JSON.stringify(input.body ?? {}));
    if (bodyBytes > 2_000_000) {
      throw new DeputyApiError(
        "provider_validation_error",
        "Deputy request body exceeds the 2 MB Relay limit.",
      );
    }
    if (input.contentBase64) {
      let bytes: Buffer;
      try {
        bytes = Buffer.from(input.contentBase64, "base64");
      } catch {
        throw new DeputyApiError(
          "provider_validation_error",
          "Deputy upload content must be valid base64.",
        );
      }
      if (bytes.byteLength > 2_000_000) {
        throw new DeputyApiError(
          "provider_validation_error",
          "Deputy upload exceeds the 2 MB Relay limit.",
        );
      }
    }
    const apiOrigin = this.normalizeApiOrigin(apiOriginValue);
    const url = this.buildUrl(operation, apiOrigin, input);
    const headers = this.buildHeaders(
      accessToken,
      operation,
      input.headers ?? {},
    );
    const body = this.buildBody(operation, input, headers);
    return this.directRequest(
      accessToken,
      apiOrigin,
      `${url.pathname}${url.search}`,
      operation.method,
      body,
      headers,
      operation.responseMode,
    );
  }

  private async directRequest(
    accessToken: string,
    apiOriginValue: string,
    target: string,
    method: string,
    body?: BodyInit,
    providedHeaders: Record<string, string> = {},
    responseMode: "json" | "binary" = "json",
  ) {
    if (!accessToken) {
      throw new DeputyApiError(
        "credential_missing",
        "Deputy access token is required.",
        401,
      );
    }
    const apiOrigin = this.normalizeApiOrigin(apiOriginValue);
    const url = new URL(target, `${apiOrigin}/`);
    if (
      url.origin !== apiOrigin ||
      (!url.pathname.startsWith("/api/v1/") &&
        !url.pathname.startsWith("/api/v2/"))
    ) {
      throw new DeputyApiError(
        "policy_blocked",
        "Deputy request escaped the OAuth-bound v1/v2 install authority.",
      );
    }
    const response = await safeConnectorFetch(url, {
      method,
      headers: {
        Accept:
          responseMode === "binary"
            ? "application/octet-stream, application/json"
            : "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...providedHeaders,
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      throw new DeputyApiError(
        "policy_blocked",
        "Deputy returned a redirect that Relay will not follow outside the fixed install authority.",
        response.status,
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 2_500_000) {
      throw new DeputyApiError(
        "provider_validation_error",
        "Deputy response exceeds the 2.5 MB Relay limit.",
      );
    }
    const data =
      responseMode === "binary" && response.ok
        ? {
            contentBase64: bytes.toString("base64"),
            contentType:
              response.headers.get("content-type") ??
              "application/octet-stream",
          }
        : this.parseResponse(bytes);
    const redacted = this.redact(data);
    if (!response.ok) {
      throw new DeputyApiError(
        this.safeCode(response.status),
        this.errorMessage(redacted) ??
          `Deputy returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return redacted;
  }

  private buildUrl(
    operation: DeputyOperation,
    apiOrigin: string,
    input: DeputyOperationInput,
  ) {
    const pathValues = input.pathParameters ?? {};
    this.assertAllowedKeys(
      pathValues,
      operation.pathParameters,
      "path parameter",
    );
    let path = operation.path;
    for (const name of operation.pathParameters) {
      const value = this.scalar(pathValues[name]);
      if (value === null) {
        throw new DeputyApiError(
          "provider_validation_error",
          `Deputy path parameter ${name} is required.`,
        );
      }
      path = path.replaceAll(`{${name}}`, encodeURIComponent(value));
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://")) {
      throw new DeputyApiError(
        "policy_blocked",
        "Deputy path did not resolve to a safe pinned route.",
      );
    }
    const url = new URL(`/api${path}`, `${apiOrigin}/`);
    const query = input.query ?? {};
    this.assertAllowedKeys(query, operation.queryParameters, "query parameter");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100) {
        throw new DeputyApiError(
          "provider_validation_error",
          `Deputy query ${name} has too many values.`,
        );
      }
      for (const rawValue of values) {
        const value = this.scalar(rawValue);
        if (value !== null) url.searchParams.append(name, value);
      }
    }
    for (const key of ["max", "limit", "pageSize", "perPage"]) {
      const value = url.searchParams.get(key);
      if (value !== null && (!/^\d+$/.test(value) || Number(value) > 500)) {
        throw new DeputyApiError(
          "provider_validation_error",
          `Deputy ${key} must be an integer from 0 to 500.`,
        );
      }
    }
    return url;
  }

  private buildHeaders(
    accessToken: string,
    operation: DeputyOperation,
    provided: JsonObject,
  ) {
    this.assertAllowedKeys(provided, operation.headerParameters, "header");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    for (const [name, raw] of Object.entries(provided)) {
      if (!/^x-[a-z0-9-]+$/i.test(name)) {
        throw new DeputyApiError(
          "policy_blocked",
          `Deputy header ${name} is not allowed.`,
        );
      }
      const value = this.scalar(raw);
      if (value !== null) headers[name] = value;
    }
    return headers;
  }

  private buildBody(
    operation: DeputyOperation,
    input: DeputyOperationInput,
    headers: Record<string, string>,
  ): BodyInit | undefined {
    const body = input.body ?? {};
    if (operation.bodyParameters.length) {
      this.assertAllowedKeys(body, operation.bodyParameters, "body field");
    }
    if (operation.bodyMode === "none") return undefined;
    if (operation.bodyMode === "form") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      const form = new URLSearchParams();
      for (const [name, raw] of Object.entries(body)) {
        const value = this.scalar(raw);
        if (value !== null) form.set(name, value);
      }
      return form;
    }
    if (operation.bodyMode === "multipart") {
      const form = new FormData();
      for (const [name, raw] of Object.entries(body)) {
        const value = this.scalar(raw);
        if (value !== null) form.set(name, value);
      }
      if (input.contentBase64) {
        const fileField =
          operation.bodyParameters.find((name) =>
            /(file|upload|attachment|document|content)/i.test(name),
          ) ?? "file";
        if (
          operation.bodyParameters.length &&
          !operation.bodyParameters.includes(fileField)
        ) {
          throw new DeputyApiError(
            "provider_validation_error",
            "Deputy operation does not document a file field.",
          );
        }
        form.set(
          fileField,
          new Blob([Buffer.from(input.contentBase64, "base64")], {
            type: input.mimeType ?? "application/octet-stream",
          }),
          input.fileName ?? "upload.bin",
        );
      }
      return form;
    }
    headers["Content-Type"] = "application/json";
    return JSON.stringify(body);
  }

  private assertGroup(
    operationId: string,
    allowed: readonly string[],
    label: string,
  ) {
    if (!allowed.includes(operationId)) {
      throw new DeputyApiError(
        "provider_validation_error",
        `Deputy ${label} operation is not allowed by this tool.`,
      );
    }
  }

  private assertAllowedKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        throw new DeputyApiError(
          "provider_validation_error",
          `Deputy ${label} ${key} is not allowed for this operation.`,
        );
      }
    }
  }

  private rejectCredentialFields(value: unknown, path = "input") {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(authorization|access.?token|refresh.?token|client.?secret|password|api.?key|cookie)/i.test(
          key,
        )
      ) {
        throw new DeputyApiError(
          "policy_blocked",
          `Credential-shaped Deputy field is not allowed at ${path}.${key}.`,
        );
      }
      this.rejectCredentialFields(child, `${path}.${key}`);
    }
  }

  private scalar(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (["string", "number", "boolean"].includes(typeof value))
      return String(value);
    throw new DeputyApiError(
      "provider_validation_error",
      "Deputy parameters must be scalar values.",
    );
  }

  private parseResponse(bytes: Buffer): unknown {
    if (!bytes.byteLength) return null;
    const text = bytes.toString("utf8");
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 2_000) };
    }
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== "object") return value;
    const output: JsonObject = {};
    for (const [key, child] of Object.entries(value as JsonObject)) {
      output[key] =
        /(access.?token|refresh.?token|client.?secret|password|api.?key|cookie)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(child);
    }
    return output;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;
    const object = value as JsonObject;
    for (const key of ["message", "error", "error_description", "Message"]) {
      if (typeof object[key] === "string")
        return String(object[key]).slice(0, 500);
    }
    return null;
  }
}
