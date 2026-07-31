import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  EGNYTE_ADMIN_OPERATION_IDS,
  EGNYTE_CONTENT_WRITE_OPERATION_IDS,
  EGNYTE_OPERATION_BY_ID,
  EGNYTE_READ_OPERATION_IDS,
  type EgnyteOperation,
} from "./egnyte-operation-registry";

type JsonObject = Record<string, unknown>;

export type EgnyteOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  headers?: JsonObject;
  body?: JsonObject;
  contentBase64?: string;
  fileName?: string;
  mimeType?: string;
};

export class EgnyteApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class EgnyteApiAdapter {
  async getCurrentUser(accessToken: string, domainValue: string) {
    if (!accessToken) {
      throw new EgnyteApiError(
        "credential_missing",
        "Egnyte access token is required.",
        401,
      );
    }
    const domain = this.normalizeDomain(domainValue);
    const response = await safeConnectorFetch(
      `https://${domain}.egnyte.com/pubapi/v1/userinfo`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    const data = this.redact(this.parseResponse(bytes));
    if (!response.ok) {
      throw new EgnyteApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Egnyte returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  read(
    accessToken: string,
    domain: string,
    operationId: string,
    input: EgnyteOperationInput,
  ) {
    this.assertGroup(operationId, EGNYTE_READ_OPERATION_IDS, "read");
    return this.request(accessToken, domain, operationId, input);
  }

  manageContent(
    accessToken: string,
    domain: string,
    operationId: string,
    input: EgnyteOperationInput,
  ) {
    this.assertGroup(
      operationId,
      EGNYTE_CONTENT_WRITE_OPERATION_IDS,
      "content mutation",
    );
    return this.request(accessToken, domain, operationId, input);
  }

  admin(
    accessToken: string,
    domain: string,
    operationId: string,
    input: EgnyteOperationInput,
  ) {
    this.assertGroup(
      operationId,
      EGNYTE_ADMIN_OPERATION_IDS,
      "administrative mutation",
    );
    return this.request(accessToken, domain, operationId, input);
  }

  normalizeDomain(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https:\/\//, "")
      .replace(/\.egnyte\.com\/?$/, "")
      .replace(/\/$/, "");
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
      throw new EgnyteApiError(
        "provider_validation_error",
        "Enter a valid Egnyte domain, such as acme or acme.egnyte.com.",
      );
    }
    return normalized;
  }

  private async request(
    accessToken: string,
    domainValue: string,
    operationId: string,
    input: EgnyteOperationInput,
  ) {
    const operation = EGNYTE_OPERATION_BY_ID.get(operationId);
    if (!operation) {
      throw new EgnyteApiError(
        "provider_validation_error",
        "Egnyte operation is not in the pinned official specification.",
      );
    }
    if (!accessToken) {
      throw new EgnyteApiError(
        "credential_missing",
        "Egnyte access token is required.",
        401,
      );
    }
    const domain = this.normalizeDomain(domainValue);
    this.rejectCredentialFields(input);
    this.assertBounded(input);
    const url = this.buildUrl(operation, domain, input);
    const headers = this.buildHeaders(
      accessToken,
      operation,
      input.headers ?? {},
    );
    const body = this.buildBody(operation, input, headers);
    const response = await safeConnectorFetch(url, {
      method: operation.method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(operation.method === "GET" ? 20_000 : 30_000),
      cache: "no-store",
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 2_500_000) {
      throw new EgnyteApiError(
        "provider_validation_error",
        "Egnyte response exceeds the 2.5 MB Relay limit.",
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    const data =
      operation.responseMode === "binary" && response.ok
        ? {
            contentBase64: bytes.toString("base64"),
            contentType: contentType || "application/octet-stream",
            contentDisposition: (
              response.headers.get("content-disposition") ?? ""
            ).slice(0, 500),
          }
        : this.parseResponse(bytes);
    const redacted = this.redact(data);
    if (!response.ok) {
      throw new EgnyteApiError(
        this.safeCode(response.status),
        this.errorMessage(redacted) ??
          `Egnyte returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return redacted;
  }

  private assertGroup(
    operationId: string,
    allowed: readonly string[],
    label: string,
  ) {
    if (!allowed.includes(operationId)) {
      throw new EgnyteApiError(
        "provider_validation_error",
        `Egnyte ${label} operation is not allowed by this tool.`,
      );
    }
  }

  private buildUrl(
    operation: EgnyteOperation,
    domain: string,
    input: EgnyteOperationInput,
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
        throw new EgnyteApiError(
          "provider_validation_error",
          `Egnyte path parameter ${name} is required.`,
        );
      }
      path = path.replaceAll(`{${name}}`, encodeURIComponent(value));
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://")) {
      throw new EgnyteApiError(
        "policy_blocked",
        "Egnyte path did not resolve to a safe pinned route.",
      );
    }
    const url = new URL(
      `https://${domain}.egnyte.com/pubapi${path.startsWith("/") ? path : `/${path}`}`,
    );
    const query = input.query ?? {};
    this.assertAllowedKeys(query, operation.queryParameters, "query parameter");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100) {
        throw new EgnyteApiError(
          "provider_validation_error",
          `Egnyte query ${name} has too many values.`,
        );
      }
      for (const value of values) {
        const scalar = this.scalar(value);
        if (scalar !== null) url.searchParams.append(name, scalar);
      }
    }
    return url;
  }

  private buildHeaders(
    accessToken: string,
    operation: EgnyteOperation,
    provided: JsonObject,
  ) {
    this.assertAllowedKeys(provided, operation.headerParameters, "header");
    const headers: Record<string, string> = {
      Accept:
        operation.responseMode === "binary"
          ? "application/octet-stream, text/csv"
          : "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    for (const [name, raw] of Object.entries(provided)) {
      const value = this.scalar(raw);
      if (value !== null) headers[name] = value;
    }
    return headers;
  }

  private buildBody(
    operation: EgnyteOperation,
    input: EgnyteOperationInput,
    headers: Record<string, string>,
  ): BodyInit | undefined {
    const body = input.body ?? {};
    if (operation.bodyParameters.length) {
      this.assertAllowedKeys(body, operation.bodyParameters, "body field");
    }
    if (operation.bodyMode === "json") {
      headers["Content-Type"] = "application/json";
      return JSON.stringify(body);
    }
    if (operation.bodyMode === "form") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      const form = new URLSearchParams();
      for (const [name, raw] of Object.entries(body)) {
        const value = this.scalar(raw);
        if (value !== null) form.append(name, value);
      }
      return form;
    }
    if (operation.bodyMode === "multipart") {
      const form = new FormData();
      for (const [name, raw] of Object.entries(body)) {
        const value = this.scalar(raw);
        if (value !== null) form.append(name, value);
      }
      if (input.contentBase64) {
        form.append(
          "file",
          new Blob([this.decodeContent(input.contentBase64)], {
            type: input.mimeType?.slice(0, 200) || "application/octet-stream",
          }),
          input.fileName?.slice(0, 255) || "upload.bin",
        );
      }
      return form;
    }
    if (Object.keys(body).length || input.contentBase64) {
      throw new EgnyteApiError(
        "provider_validation_error",
        "This Egnyte operation does not accept a request body.",
      );
    }
    return undefined;
  }

  private decodeContent(value: string) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
      throw new EgnyteApiError(
        "provider_validation_error",
        "Egnyte upload content is not valid base64.",
      );
    }
    const bytes = Buffer.from(value, "base64");
    if (bytes.byteLength > 2_000_000) {
      throw new EgnyteApiError(
        "provider_validation_error",
        "Egnyte upload content exceeds 2 MB.",
      );
    }
    return bytes;
  }

  private assertAllowedKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        throw new EgnyteApiError(
          "provider_validation_error",
          `Egnyte ${label} ${key} is not documented for this operation.`,
        );
      }
    }
  }

  private scalar(value: unknown) {
    if (typeof value === "string" && value.length <= 20_000) return value;
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    if (typeof value === "boolean") return String(value);
    return null;
  }

  private assertBounded(input: EgnyteOperationInput) {
    const encoded = JSON.stringify(input);
    if (Buffer.byteLength(encoded) > 2_900_000) {
      throw new EgnyteApiError(
        "provider_validation_error",
        "Egnyte request exceeds the Relay size limit.",
      );
    }
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10 || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      if (value.length > 1_000)
        throw new EgnyteApiError(
          "provider_validation_error",
          "Egnyte request contains too many array items.",
        );
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|client[_-]?id|api[_-]?key)/i.test(
          key,
        )
      ) {
        throw new EgnyteApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private parseResponse(bytes: Buffer) {
    const raw = bytes.toString("utf8");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(0, 2_500_000);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject).slice(
      0,
      500,
    )) {
      result[key] =
        /(token|secret|authorization|password|cookie|credential|api[_-]?key)/i.test(
          key,
        )
          ? "[redacted]"
          : this.redact(item, depth + 1);
    }
    return result;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown): string | null {
    if (typeof value === "string") return value.slice(0, 500);
    if (!value || typeof value !== "object") return null;
    const object = value as JsonObject;
    for (const candidate of [
      object.message,
      object.error_description,
      object.error,
      object.detail,
    ]) {
      if (typeof candidate === "string") return candidate.slice(0, 500);
    }
    return null;
  }
}
