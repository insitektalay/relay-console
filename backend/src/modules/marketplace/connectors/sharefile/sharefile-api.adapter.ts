import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  SHAREFILE_ADMIN_OPERATION_IDS,
  SHAREFILE_CONTENT_WRITE_OPERATION_IDS,
  SHAREFILE_OPERATION_BY_ID,
  SHAREFILE_READ_OPERATION_IDS,
  type ShareFileOperation,
} from "./sharefile-operation-registry";

type JsonObject = Record<string, unknown>;
export type ShareFileOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  body?: JsonObject;
};

export class ShareFileApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ShareFileApiAdapter {
  getCurrentUser(accessToken: string, apiOrigin: string) {
    return this.directRequest(accessToken, apiOrigin, "/sf/v3/Users", "GET");
  }

  read(
    accessToken: string,
    apiOrigin: string,
    operationId: string,
    input: ShareFileOperationInput,
  ) {
    this.assertGroup(operationId, SHAREFILE_READ_OPERATION_IDS, "read");
    return this.request(accessToken, apiOrigin, operationId, input);
  }

  manageContent(
    accessToken: string,
    apiOrigin: string,
    operationId: string,
    input: ShareFileOperationInput,
  ) {
    this.assertGroup(
      operationId,
      SHAREFILE_CONTENT_WRITE_OPERATION_IDS,
      "content mutation",
    );
    return this.request(accessToken, apiOrigin, operationId, input);
  }

  admin(
    accessToken: string,
    apiOrigin: string,
    operationId: string,
    input: ShareFileOperationInput,
  ) {
    this.assertGroup(
      operationId,
      SHAREFILE_ADMIN_OPERATION_IDS,
      "administrative mutation",
    );
    return this.request(accessToken, apiOrigin, operationId, input);
  }

  normalizeApiOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new ShareFileApiError(
        "provider_validation_error",
        "ShareFile account authority is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new ShareFileApiError(
        "policy_blocked",
        "ShareFile account authority must be an HTTPS origin without credentials, ports, paths, or query data.",
      );
    }
    const labels = url.hostname.toLowerCase().split(".");
    if (
      labels.length < 3 ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(labels[0])
    ) {
      throw new ShareFileApiError(
        "policy_blocked",
        "ShareFile account authority has an invalid tenant subdomain.",
      );
    }
    const controlPlane = labels.slice(1).join(".");
    if (
      !["sf-api.com", "sharefile.com", "securevdr.com"].includes(controlPlane)
    ) {
      throw new ShareFileApiError(
        "policy_blocked",
        "ShareFile account authority is outside the documented ShareFile control planes.",
      );
    }
    return `https://${url.hostname.toLowerCase()}`;
  }

  private async request(
    accessToken: string,
    apiOriginValue: string,
    operationId: string,
    input: ShareFileOperationInput,
  ) {
    const operation = SHAREFILE_OPERATION_BY_ID.get(operationId);
    if (!operation)
      throw new ShareFileApiError(
        "provider_validation_error",
        "ShareFile operation is not in the pinned official documentation.",
      );
    if (!accessToken)
      throw new ShareFileApiError(
        "credential_missing",
        "ShareFile access token is required.",
        401,
      );
    this.rejectCredentialFields(input);
    const bodyBytes = Buffer.byteLength(JSON.stringify(input.body ?? {}));
    if (bodyBytes > 2_000_000)
      throw new ShareFileApiError(
        "provider_validation_error",
        "ShareFile request body exceeds the 2 MB Relay limit.",
      );
    const apiOrigin = this.normalizeApiOrigin(apiOriginValue);
    const url = this.buildUrl(operation, apiOrigin, input);
    return this.directRequest(
      accessToken,
      apiOrigin,
      `${url.pathname}${url.search}`,
      operation.method,
      operation.bodyMode === "json" ? (input.body ?? {}) : undefined,
    );
  }

  private async directRequest(
    accessToken: string,
    apiOriginValue: string,
    target: string,
    method: string,
    body?: JsonObject,
  ) {
    if (!accessToken)
      throw new ShareFileApiError(
        "credential_missing",
        "ShareFile access token is required.",
        401,
      );
    const apiOrigin = this.normalizeApiOrigin(apiOriginValue);
    const url = new URL(target, `${apiOrigin}/`);
    if (url.origin !== apiOrigin || !url.pathname.startsWith("/sf/v3/")) {
      throw new ShareFileApiError(
        "policy_blocked",
        "ShareFile request escaped the bound v3 account authority.",
      );
    }
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    const requestBody = body === undefined ? undefined : JSON.stringify(body);
    if (requestBody !== undefined) headers["Content-Type"] = "application/json";
    const response = await safeConnectorFetch(url, {
      method,
      headers,
      body: requestBody,
      redirect: "manual",
      signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      throw new ShareFileApiError(
        "policy_blocked",
        "ShareFile returned a redirect that Relay will not follow outside the fixed account authority.",
        response.status,
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 2_500_000)
      throw new ShareFileApiError(
        "provider_validation_error",
        "ShareFile response exceeds the 2.5 MB Relay limit.",
      );
    const data = this.redact(this.parseResponse(bytes));
    if (!response.ok)
      throw new ShareFileApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `ShareFile returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private buildUrl(
    operation: ShareFileOperation,
    apiOrigin: string,
    input: ShareFileOperationInput,
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
      if (value === null)
        throw new ShareFileApiError(
          "provider_validation_error",
          `ShareFile path parameter ${name} is required.`,
        );
      path = path.replaceAll(`{${name}}`, encodeURIComponent(value));
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://")) {
      throw new ShareFileApiError(
        "policy_blocked",
        "ShareFile path did not resolve to a safe pinned route.",
      );
    }
    const url = new URL(path, `${apiOrigin}/`);
    const query = input.query ?? {};
    const odata = [
      "$select",
      "$expand",
      "$filter",
      "$orderby",
      "$top",
      "$skip",
    ];
    this.assertAllowedKeys(
      query,
      [...operation.queryParameters, ...odata],
      "query parameter",
    );
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw new ShareFileApiError(
          "provider_validation_error",
          `ShareFile query ${name} has too many values.`,
        );
      for (const rawValue of values) {
        const value = this.scalar(rawValue);
        if (value !== null) url.searchParams.append(name, value);
      }
    }
    const top = url.searchParams.get("$top");
    if (top !== null && (!/^\d+$/.test(top) || Number(top) > 200)) {
      throw new ShareFileApiError(
        "provider_validation_error",
        "ShareFile $top must be an integer from 0 to 200.",
      );
    }
    return url;
  }

  private assertGroup(
    operationId: string,
    allowed: readonly string[],
    label: string,
  ) {
    if (!allowed.includes(operationId))
      throw new ShareFileApiError(
        "provider_validation_error",
        `ShareFile ${label} operation is not allowed by this tool.`,
      );
  }

  private assertAllowedKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key))
        throw new ShareFileApiError(
          "provider_validation_error",
          `ShareFile ${label} ${key} is not allowed for this operation.`,
        );
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
        throw new ShareFileApiError(
          "policy_blocked",
          `Credential-shaped ShareFile field is not allowed at ${path}.${key}.`,
        );
      }
      this.rejectCredentialFields(child, `${path}.${key}`);
    }
  }

  private scalar(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (["string", "number", "boolean"].includes(typeof value)) {
      const text = String(value);
      if (text.length > 20_000)
        throw new ShareFileApiError(
          "provider_validation_error",
          "ShareFile parameter is too long.",
        );
      return text;
    }
    throw new ShareFileApiError(
      "provider_validation_error",
      "ShareFile parameters must be scalar values.",
    );
  }

  private parseResponse(bytes: Buffer): unknown {
    if (!bytes.length) return {};
    const text = bytes.toString("utf8");
    try {
      return JSON.parse(text);
    } catch {
      return { text: text.slice(0, 100_000) };
    }
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item));
    if (!value || typeof value !== "object") return value;
    const output: JsonObject = {};
    for (const [key, child] of Object.entries(value as JsonObject).slice(
      0,
      1000,
    )) {
      output[key] =
        /(token|secret|password|authorization|cookie|api.?key)/i.test(key)
          ? "[REDACTED]"
          : this.redact(child);
    }
    return output;
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const body = value as JsonObject;
    for (const key of ["message", "error_description", "error", "Message"]) {
      if (typeof body[key] === "string") return String(body[key]).slice(0, 500);
    }
    return null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
