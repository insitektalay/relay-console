import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  PCLOUD_OPERATION_BY_ID,
  PCLOUD_OPERATIONS,
  PCLOUD_READ_OPERATION_IDS,
  PCLOUD_WRITE_OPERATION_IDS,
} from "./pcloud-operation-registry";

type JsonObject = Record<string, unknown>;
export type PCloudOperationInput = {
  parameters?: JsonObject;
  fileBase64?: string;
  fileName?: string;
};

export class PCloudApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PCloudApiAdapter {
  getCurrentUser(accessToken: string, apiOrigin: string) {
    return this.directRequest(
      accessToken,
      apiOrigin,
      "userinfo",
      {},
      "GET",
      "json",
      "form",
    );
  }

  revoke(accessToken: string, apiOrigin: string) {
    return this.directRequest(
      accessToken,
      apiOrigin,
      "logout",
      {},
      "POST",
      "json",
      "form",
    );
  }

  read(
    accessToken: string,
    apiOrigin: string,
    operation: string,
    input: PCloudOperationInput,
  ) {
    this.assertGroup(operation, PCLOUD_READ_OPERATION_IDS, "read");
    return this.request(accessToken, apiOrigin, operation, input);
  }

  write(
    accessToken: string,
    apiOrigin: string,
    operation: string,
    input: PCloudOperationInput,
  ) {
    this.assertGroup(operation, PCLOUD_WRITE_OPERATION_IDS, "write");
    return this.request(accessToken, apiOrigin, operation, input);
  }

  normalizeApiOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new PCloudApiError(
        "provider_validation_error",
        "pCloud API authority is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !["api.pcloud.com", "eapi.pcloud.com"].includes(
        url.hostname.toLowerCase(),
      )
    ) {
      throw new PCloudApiError(
        "policy_blocked",
        "pCloud API authority must be the OAuth-bound US or Europe API origin.",
      );
    }
    return `https://${url.hostname.toLowerCase()}`;
  }

  private request(
    accessToken: string,
    apiOrigin: string,
    operationId: string,
    input: PCloudOperationInput,
  ) {
    const operation = PCLOUD_OPERATION_BY_ID.get(
      operationId as (typeof PCLOUD_OPERATIONS)[number]["id"],
    );
    if (!operation)
      throw new PCloudApiError(
        "provider_validation_error",
        "pCloud operation is not in the pinned official documentation.",
      );
    const parameters = input.parameters ?? {};
    this.rejectCredentialFields(parameters);
    this.assertAllowedKeys(parameters, operation.parameters);
    if (
      operation.bodyMode !== "multipart" &&
      (input.fileBase64 || input.fileName)
    ) {
      throw new PCloudApiError(
        "provider_validation_error",
        "File content is only accepted by a pinned pCloud upload operation.",
      );
    }
    return this.directRequest(
      accessToken,
      apiOrigin,
      operation.id,
      parameters,
      operation.method,
      operation.responseMode,
      operation.bodyMode,
      input.fileBase64,
      input.fileName,
    );
  }

  private async directRequest(
    accessToken: string,
    apiOriginValue: string,
    methodName: string,
    parameters: JsonObject,
    method: "GET" | "POST",
    responseMode: "json" | "binary",
    bodyMode: "form" | "multipart",
    fileBase64?: string,
    fileName?: string,
  ) {
    if (!accessToken)
      throw new PCloudApiError(
        "credential_missing",
        "pCloud access token is required.",
        401,
      );
    if (!/^[a-z][a-z0-9_]*$/.test(methodName))
      throw new PCloudApiError(
        "policy_blocked",
        "pCloud method path is invalid.",
      );
    const apiOrigin = this.normalizeApiOrigin(apiOriginValue);
    const url = new URL(`/${methodName}`, `${apiOrigin}/`);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    let body: BodyInit | undefined;
    if (method === "GET") {
      this.appendParameters(url.searchParams, parameters);
    } else if (bodyMode === "multipart") {
      if (!fileBase64)
        throw new PCloudApiError(
          "provider_validation_error",
          `${methodName} requires fileBase64.`,
        );
      let bytes: Buffer;
      try {
        bytes = Buffer.from(fileBase64, "base64");
      } catch {
        throw new PCloudApiError(
          "provider_validation_error",
          "pCloud upload content is not valid base64.",
        );
      }
      if (!bytes.length || bytes.byteLength > 2_000_000)
        throw new PCloudApiError(
          "provider_validation_error",
          "pCloud upload must contain 1 byte to 2 MB.",
        );
      const form = new FormData();
      for (const [key, value] of this.scalarEntries(parameters))
        form.append(key, value);
      form.append(
        "file",
        new Blob([Uint8Array.from(bytes)]),
        this.safeFileName(fileName),
      );
      body = form;
    } else {
      const form = new URLSearchParams();
      this.appendParameters(form, parameters);
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = form;
    }
    const response = await safeConnectorFetch(url, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400)
      throw new PCloudApiError(
        "policy_blocked",
        "pCloud returned a redirect that Relay will not follow outside the fixed regional API authority.",
        response.status,
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 2_500_000)
      throw new PCloudApiError(
        "provider_validation_error",
        "pCloud response exceeds the 2.5 MB Relay limit.",
      );
    const contentType = response.headers.get("content-type") ?? "";
    const parsed =
      responseMode === "binary" && !contentType.includes("json")
        ? {
            contentType: contentType || "application/octet-stream",
            byteLength: bytes.byteLength,
            contentBase64: bytes.toString("base64"),
          }
        : this.parseResponse(bytes);
    const data = this.redact(parsed);
    const result =
      data && typeof data === "object" && !Array.isArray(data)
        ? Number((data as JsonObject).result ?? 0)
        : 0;
    if (!response.ok || result !== 0)
      throw new PCloudApiError(
        this.safeCode(response.status, result),
        this.errorMessage(data) ??
          `pCloud returned result ${result || response.status}.`,
        response.status,
      );
    return data;
  }

  private appendParameters(target: URLSearchParams, parameters: JsonObject) {
    for (const [key, value] of this.scalarEntries(parameters))
      target.append(key, value);
  }

  private scalarEntries(parameters: JsonObject): Array<[string, string]> {
    const output: Array<[string, string]> = [];
    for (const [key, raw] of Object.entries(parameters)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw new PCloudApiError(
          "provider_validation_error",
          `pCloud parameter ${key} has too many values.`,
        );
      for (const value of values) {
        if (value === undefined || value === null) continue;
        if (!["string", "number", "boolean"].includes(typeof value))
          throw new PCloudApiError(
            "provider_validation_error",
            `pCloud parameter ${key} must be scalar.`,
          );
        const encoded = String(value);
        if (encoded.length > 20_000)
          throw new PCloudApiError(
            "provider_validation_error",
            `pCloud parameter ${key} is too long.`,
          );
        output.push([key, encoded]);
      }
    }
    return output;
  }

  private assertGroup(
    operation: string,
    allowed: readonly string[],
    label: string,
  ) {
    if (!allowed.includes(operation))
      throw new PCloudApiError(
        "provider_validation_error",
        `pCloud ${label} operation is not allowed by this tool.`,
      );
  }

  private assertAllowedKeys(
    parameters: JsonObject,
    allowed: readonly string[],
  ) {
    const globals = [
      "id",
      "timeformat",
      "filtermeta",
      "filterfilemeta",
      "filterfoldermeta",
      "revisionid",
    ];
    for (const key of Object.keys(parameters))
      if (![...allowed, ...globals].includes(key))
        throw new PCloudApiError(
          "provider_validation_error",
          `pCloud parameter ${key} is not documented for this operation.`,
        );
  }

  private rejectCredentialFields(value: unknown, path = "parameters") {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(authorization|access.?token|auth|client.?secret|password|api.?key|cookie|username)/i.test(
          key,
        )
      )
        throw new PCloudApiError(
          "policy_blocked",
          `Credential-shaped pCloud field is not allowed at ${path}.${key}.`,
        );
      this.rejectCredentialFields(child, `${path}.${key}`);
    }
  }

  private safeFileName(value?: string) {
    const name = value?.trim() || "upload.bin";
    if (
      name.length > 255 ||
      name.includes("/") ||
      name.includes("\\") ||
      name.includes("\0")
    )
      throw new PCloudApiError(
        "provider_validation_error",
        "pCloud upload filename is invalid.",
      );
    return name;
  }

  private parseResponse(bytes: Buffer): unknown {
    if (!bytes.length) return {};
    try {
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      return { text: bytes.toString("utf8").slice(0, 100_000) };
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
    ))
      output[key] =
        /(token|secret|password|authorization|cookie|api.?key)/i.test(key)
          ? "[REDACTED]"
          : this.redact(child);
    return output;
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object") return null;
    for (const key of ["error", "message"])
      if (typeof (value as JsonObject)[key] === "string")
        return String((value as JsonObject)[key]).slice(0, 500);
    return null;
  }

  private safeCode(
    status: number,
    result: number,
  ): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || [1000, 2000].includes(result)) return "token_expired";
    if (status === 403 || result === 2003) return "insufficient_scope";
    if (status === 429 || result === 4000) return "provider_rate_limited";
    if (status >= 500 || result >= 5000) return "provider_unavailable";
    return "provider_validation_error";
  }
}
