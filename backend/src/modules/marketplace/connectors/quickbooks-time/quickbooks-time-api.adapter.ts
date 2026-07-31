import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  QUICKBOOKS_TIME_OPERATION_BY_ID,
  type QuickBooksTimeOperation,
} from "./quickbooks-time-operation-registry";

type JsonObject = Record<string, unknown>;
export type QuickBooksTimeCredentials = { accessToken: string };
export type QuickBooksTimeOperationInput = {
  query?: JsonObject;
  json?: JsonObject;
};

export class QuickBooksTimeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class QuickBooksTimeApiAdapter {
  private static readonly ORIGIN = "https://rest.tsheets.com";

  health(credentials: QuickBooksTimeCredentials) {
    return this.directRequest(
      credentials,
      "/api/v1/current_user",
      "GET",
      "json",
    );
  }

  read(
    credentials: QuickBooksTimeCredentials,
    operationId: string,
    input: QuickBooksTimeOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("QuickBooks Time read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: QuickBooksTimeCredentials,
    operationId: string,
    input: QuickBooksTimeOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid(
        "QuickBooks Time manage accepts mutation operations only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: QuickBooksTimeCredentials,
    operation: QuickBooksTimeOperation,
    input: QuickBooksTimeOperationInput,
  ) {
    this.rejectCredentialFields(input);
    if (
      !operation.path.startsWith("/") ||
      operation.path.includes("..") ||
      operation.path.includes("://")
    ) {
      throw new QuickBooksTimeApiError(
        "policy_blocked",
        "QuickBooks Time path escaped the pinned public API route.",
        403,
      );
    }
    const url = new URL(
      `/api/v1${operation.path}`,
      QuickBooksTimeApiAdapter.ORIGIN,
    );
    const query = input.query ?? {};
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 200)
        throw this.invalid(
          `QuickBooks Time query ${name} has too many values.`,
        );
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        url.searchParams.append(name, this.scalar(item, name));
      }
    }
    const limit = url.searchParams.get("limit");
    if (
      limit &&
      (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 200)
    )
      throw this.invalid(
        "QuickBooks Time limit must be an integer from 1 through 200.",
      );
    const page = url.searchParams.get("page");
    if (
      page &&
      (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 10_000)
    )
      throw this.invalid(
        "QuickBooks Time page must be a positive bounded integer.",
      );
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid(
        "This QuickBooks Time operation does not accept a JSON body.",
      );
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid(
        "QuickBooks Time request exceeds the 2 MB Relay limit.",
      );
    return this.directRequest(
      credentials,
      `${url.pathname}${url.search}`,
      operation.method,
      operation.responseType,
      body,
    );
  }

  private async directRequest(
    credentials: QuickBooksTimeCredentials,
    target: string,
    method: string,
    responseType: "json" | "binary",
    body?: string,
  ) {
    this.requireCredentials(credentials);
    const url = new URL(target, QuickBooksTimeApiAdapter.ORIGIN);
    if (
      url.origin !== QuickBooksTimeApiAdapter.ORIGIN ||
      url.protocol !== "https:" ||
      !url.pathname.startsWith("/api/v1/")
    ) {
      throw new QuickBooksTimeApiError(
        "policy_blocked",
        "QuickBooks Time requests must stay on the fixed HTTPS v1 API origin.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: responseType === "binary" ? "*/*" : "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof QuickBooksTimeApiError) throw error;
      throw new QuickBooksTimeApiError(
        "provider_unavailable",
        "QuickBooks Time could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid(
        "QuickBooks Time response exceeds the 2.5 MB Relay limit.",
      );
    const contentType = response.headers.get("content-type") ?? "";
    const data =
      responseType === "binary" && response.ok
        ? {
            contentType: contentType.slice(0, 200),
            byteLength: raw.byteLength,
            dataBase64: raw.toString("base64"),
          }
        : this.redact(this.parse(raw));
    if (!response.ok)
      throw new QuickBooksTimeApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `QuickBooks Time returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private operation(id: string) {
    const operation = QUICKBOOKS_TIME_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "QuickBooks Time operation is not in the pinned official API contract.",
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
          `QuickBooks Time ${label} parameter ${key} is not allowed for this operation.`,
        );
  }

  private scalar(value: unknown, name: string) {
    if (typeof value === "object")
      throw this.invalid(
        `QuickBooks Time query ${name} must be a scalar or scalar array.`,
      );
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text))
      throw this.invalid(`QuickBooks Time query ${name} is invalid.`);
    return text;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10)
      throw new QuickBooksTimeApiError(
        "policy_blocked",
        "QuickBooks Time request is too deeply nested.",
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
        throw new QuickBooksTimeApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private requireCredentials(credentials: QuickBooksTimeCredentials) {
    if (
      !credentials.accessToken ||
      credentials.accessToken.length < 16 ||
      credentials.accessToken.length > 16_000 ||
      /[\r\n]/.test(credentials.accessToken)
    )
      throw new QuickBooksTimeApiError(
        "credential_missing",
        "A valid customer-owned QuickBooks Time access token is required.",
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
    if ([402, 403, 499].includes(status)) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const body = value as JsonObject;
    const nested =
      body.error && typeof body.error === "object" && !Array.isArray(body.error)
        ? (body.error as JsonObject)
        : null;
    const candidate =
      nested?.message ?? body.error ?? body.message ?? body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new QuickBooksTimeApiError(
      "provider_validation_error",
      message,
      400,
    );
  }
}
