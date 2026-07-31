import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  ZOHO_WORKDRIVE_ADMIN_OPERATION_IDS,
  ZOHO_WORKDRIVE_CONTENT_WRITE_OPERATION_IDS,
  ZOHO_WORKDRIVE_OPERATION_BY_ID,
  ZOHO_WORKDRIVE_READ_OPERATION_IDS,
  type ZohoWorkDriveOperation,
} from "./zoho-workdrive-operation-registry";

type JsonObject = Record<string, unknown>;

export type ZohoWorkDriveOrigins = {
  apiOrigin: string;
  downloadOrigin: string;
  uploadOrigin: string;
};

export type ZohoWorkDriveOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  headers?: JsonObject;
  body?: JsonObject;
  contentBase64?: string;
  fileName?: string;
  mimeType?: string;
};

const ALLOWED_ORIGINS = new Set([
  "https://www.zohoapis.com",
  "https://www.zohoapis.eu",
  "https://www.zohoapis.in",
  "https://www.zohoapis.com.au",
  "https://www.zohoapis.com.cn",
  "https://www.zohoapis.jp",
  "https://www.zohoapis.ae",
  "https://www.zohoapis.ca",
  "https://www.zohoapis.sa",
  "https://download.zoho.com",
  "https://download.zoho.eu",
  "https://download.zoho.in",
  "https://download.zoho.com.au",
  "https://download.zoho.com.cn",
  "https://download.zoho.jp",
  "https://download.zohocloud.ca",
  "https://files.zoho.ae",
  "https://files.zoho.sa",
  "https://upload.zoho.com",
  "https://upload.zoho.eu",
  "https://upload.zoho.in",
  "https://upload.zoho.com.au",
  "https://upload.zoho.com.cn",
  "https://upload.zoho.jp",
  "https://upload.zohocloud.ca",
]);

export class ZohoWorkDriveApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ZohoWorkDriveApiAdapter {
  getCurrentUser(accessToken: string, origins: ZohoWorkDriveOrigins) {
    return this.request(accessToken, origins, "Get_User_Info", {});
  }

  read(
    accessToken: string,
    origins: ZohoWorkDriveOrigins,
    operationId: string,
    input: ZohoWorkDriveOperationInput,
  ) {
    this.assertOperationGroup(
      operationId,
      ZOHO_WORKDRIVE_READ_OPERATION_IDS,
      "read",
    );
    return this.request(accessToken, origins, operationId, input);
  }

  manageContent(
    accessToken: string,
    origins: ZohoWorkDriveOrigins,
    operationId: string,
    input: ZohoWorkDriveOperationInput,
  ) {
    this.assertOperationGroup(
      operationId,
      ZOHO_WORKDRIVE_CONTENT_WRITE_OPERATION_IDS,
      "content mutation",
    );
    return this.request(accessToken, origins, operationId, input);
  }

  admin(
    accessToken: string,
    origins: ZohoWorkDriveOrigins,
    operationId: string,
    input: ZohoWorkDriveOperationInput,
  ) {
    this.assertOperationGroup(
      operationId,
      ZOHO_WORKDRIVE_ADMIN_OPERATION_IDS,
      "administrative mutation",
    );
    return this.request(accessToken, origins, operationId, input);
  }

  private async request(
    accessToken: string,
    origins: ZohoWorkDriveOrigins,
    operationId: string,
    input: ZohoWorkDriveOperationInput,
  ) {
    const operation = ZOHO_WORKDRIVE_OPERATION_BY_ID.get(operationId);
    if (!operation) {
      throw new ZohoWorkDriveApiError(
        "provider_validation_error",
        "Zoho WorkDrive operation is not in the pinned official specification.",
      );
    }
    if (!accessToken) {
      throw new ZohoWorkDriveApiError(
        "credential_missing",
        "Zoho WorkDrive access token is required.",
        401,
      );
    }
    this.validateOrigins(origins);
    this.rejectCredentialFields(input);
    this.assertBounded(input);
    const url = this.buildUrl(operation, origins, input);
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
      throw new ZohoWorkDriveApiError(
        "provider_validation_error",
        "Zoho WorkDrive response exceeds the 2.5 MB Relay limit.",
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
      throw new ZohoWorkDriveApiError(
        this.safeCode(response.status),
        this.errorMessage(redacted) ??
          `Zoho WorkDrive returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return redacted;
  }

  private assertOperationGroup(
    operationId: string,
    allowed: readonly string[],
    label: string,
  ) {
    if (!allowed.includes(operationId)) {
      throw new ZohoWorkDriveApiError(
        "provider_validation_error",
        `Zoho WorkDrive ${label} operation is not allowed by this tool.`,
      );
    }
  }

  private validateOrigins(origins: ZohoWorkDriveOrigins) {
    for (const origin of [
      origins.apiOrigin,
      origins.downloadOrigin,
      origins.uploadOrigin,
    ]) {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new ZohoWorkDriveApiError(
          "provider_validation_error",
          "Zoho WorkDrive data-center origin is invalid.",
        );
      }
      if (
        parsed.origin !== origin ||
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        !ALLOWED_ORIGINS.has(origin)
      ) {
        throw new ZohoWorkDriveApiError(
          "policy_blocked",
          "Zoho WorkDrive data-center origin is not allowlisted.",
        );
      }
    }
  }

  private buildUrl(
    operation: ZohoWorkDriveOperation,
    origins: ZohoWorkDriveOrigins,
    input: ZohoWorkDriveOperationInput,
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
        throw new ZohoWorkDriveApiError(
          "provider_validation_error",
          `Zoho WorkDrive path parameter ${name} is required.`,
        );
      }
      path = path.replaceAll(`{${name}}`, encodeURIComponent(value));
    }
    if (
      /\{[^}]+\}/.test(path) ||
      path.includes("..") ||
      path.startsWith("/") ||
      path.includes("://")
    ) {
      throw new ZohoWorkDriveApiError(
        "policy_blocked",
        "Zoho WorkDrive path did not resolve to a safe pinned route.",
      );
    }
    const origin =
      operation.origin === "api"
        ? origins.apiOrigin
        : operation.origin === "download"
          ? origins.downloadOrigin
          : origins.uploadOrigin;
    const prefix = operation.origin === "api" ? "/workdrive/" : "/";
    const url = new URL(`${origin}${prefix}${path}`);
    const query = input.query ?? {};
    this.assertAllowedKeys(query, operation.queryParameters, "query parameter");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100) {
        throw new ZohoWorkDriveApiError(
          "provider_validation_error",
          `Zoho WorkDrive query ${name} has too many values.`,
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
    operation: ZohoWorkDriveOperation,
    provided: JsonObject,
  ) {
    this.assertAllowedKeys(provided, operation.headerParameters, "header");
    const headers: Record<string, string> = {
      Accept:
        operation.responseMode === "binary"
          ? "application/octet-stream"
          : "application/vnd.api+json",
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    };
    for (const [name, raw] of Object.entries(provided)) {
      const value = this.scalar(raw);
      if (value !== null) headers[name] = value;
    }
    return headers;
  }

  private buildBody(
    operation: ZohoWorkDriveOperation,
    input: ZohoWorkDriveOperationInput,
    headers: Record<string, string>,
  ): BodyInit | undefined {
    const body = input.body ?? {};
    if (operation.bodyParameters.length) {
      this.assertAllowedKeys(body, operation.bodyParameters, "body field");
    }
    if (operation.bodyMode === "json") {
      headers["Content-Type"] = "application/vnd.api+json";
      return JSON.stringify(body);
    }
    if (operation.bodyMode === "multipart") {
      const bytes = this.decodeContent(input.contentBase64, true);
      const form = new FormData();
      for (const [name, raw] of Object.entries(body)) {
        if (name === "content") continue;
        const value = this.scalar(raw);
        if (value !== null) form.append(name, value);
      }
      form.append(
        "content",
        new Blob([bytes], {
          type: input.mimeType?.slice(0, 200) || "application/octet-stream",
        }),
        input.fileName?.slice(0, 255) ||
          this.scalar(body.filename) ||
          "upload.bin",
      );
      return form;
    }
    if (operation.bodyMode === "binary") {
      const bytes = this.decodeContent(input.contentBase64, true);
      headers["Content-Type"] =
        input.mimeType?.slice(0, 200) || "application/octet-stream";
      return bytes;
    }
    if (Object.keys(body).length || input.contentBase64) {
      throw new ZohoWorkDriveApiError(
        "provider_validation_error",
        "This Zoho WorkDrive operation does not accept a request body.",
      );
    }
    return undefined;
  }

  private decodeContent(value: string | undefined, required: boolean) {
    if (!value) {
      if (required) {
        throw new ZohoWorkDriveApiError(
          "provider_validation_error",
          "Zoho WorkDrive file content is required.",
        );
      }
      return Buffer.alloc(0);
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
      throw new ZohoWorkDriveApiError(
        "provider_validation_error",
        "Zoho WorkDrive content must be valid base64.",
      );
    }
    const bytes = Buffer.from(value, "base64");
    if (bytes.byteLength > 2_000_000) {
      throw new ZohoWorkDriveApiError(
        "provider_validation_error",
        "Zoho WorkDrive upload exceeds the 2 MB Relay limit.",
      );
    }
    return bytes;
  }

  private assertAllowedKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    const allowedSet = new Set(allowed);
    for (const key of Object.keys(value)) {
      if (!allowedSet.has(key)) {
        throw new ZohoWorkDriveApiError(
          "provider_validation_error",
          `Zoho WorkDrive ${label} ${key} is not documented for this operation.`,
        );
      }
    }
  }

  private assertBounded(input: ZohoWorkDriveOperationInput) {
    const encoded = JSON.stringify(input);
    if (Buffer.byteLength(encoded) > 3_000_000) {
      throw new ZohoWorkDriveApiError(
        "provider_validation_error",
        "Zoho WorkDrive operation input exceeds 3 MB.",
      );
    }
  }

  private scalar(value: unknown) {
    return typeof value === "string"
      ? value.slice(0, 20_000)
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : typeof value === "boolean"
          ? String(value)
          : null;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10 || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      if (value.length > 1_000)
        throw new ZohoWorkDriveApiError(
          "provider_validation_error",
          "Zoho WorkDrive input contains too many array items.",
        );
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 500)
      throw new ZohoWorkDriveApiError(
        "provider_validation_error",
        "Zoho WorkDrive input contains too many fields.",
      );
    for (const [key, item] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|client[_-]?id|app[_-]?key)/i.test(
          key,
        )
      ) {
        throw new ZohoWorkDriveApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private parseResponse(bytes: Buffer) {
    const raw = bytes.toString("utf8");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return raw.slice(0, 2_500_000);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 2_500_000);
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential)/i.test(key)
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const errors = Array.isArray(body?.errors) ? body?.errors : [];
    const first =
      errors[0] && typeof errors[0] === "object"
        ? (errors[0] as JsonObject)
        : null;
    const title = first?.title ?? first?.detail ?? body?.message ?? body?.error;
    return typeof title === "string" ? title.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
