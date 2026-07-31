import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  SEVEN_SHIFTS_API_VERSION,
  SEVEN_SHIFTS_OPERATION_BY_ID,
  type SevenShiftsOperation,
} from "./seven-shifts-operation-registry";

type JsonObject = Record<string, unknown>;
export type SevenShiftsCredentials = {
  accessToken: string;
  companyGuid: string;
  companyId: string;
};
export type SevenShiftsOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
};

export class SevenShiftsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SevenShiftsApiAdapter {
  health(credentials: SevenShiftsCredentials) {
    return this.request(credentials, "whoAmI", {});
  }

  read(
    credentials: SevenShiftsCredentials,
    operationId: string,
    input: SevenShiftsOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("7shifts read accepts GET operations only.");
    return this.request(credentials, operationId, input);
  }

  manage(
    credentials: SevenShiftsCredentials,
    operationId: string,
    input: SevenShiftsOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid("7shifts manage accepts mutation operations only.");
    return this.request(credentials, operationId, input);
  }

  private async request(
    credentials: SevenShiftsCredentials,
    operationId: string,
    input: SevenShiftsOperationInput,
  ) {
    this.requireCredentials(credentials);
    const operation = this.operation(operationId);
    this.rejectCredentialFields(input);
    const path = this.bindPath(
      operation,
      input.pathParameters ?? {},
      credentials.companyId,
    );
    const url = new URL(path, "https://api.7shifts.com");
    this.appendQuery(url, operation, input.query ?? {}, credentials.companyId);
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid("This 7shifts operation does not accept a JSON body.");
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("7shifts request exceeds the 2 MB Relay limit.");
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "x-api-version": SEVEN_SHIFTS_API_VERSION,
          "x-company-guid": credentials.companyGuid,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (error instanceof SevenShiftsApiError) throw error;
      throw new SevenShiftsApiError(
        "provider_unavailable",
        "7shifts could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("7shifts response exceeds the 2.5 MB Relay limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new SevenShiftsApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `7shifts returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private operation(id: string) {
    const operation = SEVEN_SHIFTS_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "7shifts operation is not in the pinned official public API contract.",
      );
    return operation;
  }

  private bindPath(
    operation: SevenShiftsOperation,
    parameters: JsonObject,
    companyId: string,
  ) {
    this.exactKeys(parameters, operation.pathParameters, "path");
    let path = operation.path;
    for (const name of operation.pathParameters) {
      const expectedCompany =
        name === "company_id" ||
        (name === "id" && operation.path.startsWith("/v2/companies/{id}"));
      const value = expectedCompany
        ? companyId
        : this.segment(parameters[name], name);
      if (
        expectedCompany &&
        parameters[name] !== undefined &&
        String(parameters[name]) !== companyId
      )
        throw new SevenShiftsApiError(
          "policy_blocked",
          "7shifts requests cannot cross the connected company boundary.",
          403,
        );
      path = path.replace(`{${name}}`, encodeURIComponent(value));
    }
    return path;
  }

  private appendQuery(
    url: URL,
    operation: SevenShiftsOperation,
    query: JsonObject,
    companyId: string,
  ) {
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (name === "company_id" && String(value) !== companyId)
        throw new SevenShiftsApiError(
          "policy_blocked",
          "7shifts requests cannot cross the connected company boundary.",
          403,
        );
      if (Array.isArray(value))
        value.forEach((item) =>
          url.searchParams.append(name, this.scalar(item, name)),
        );
      else url.searchParams.set(name, this.scalar(value, name));
    }
  }

  private scalar(value: unknown, name: string) {
    if (typeof value === "object")
      throw this.invalid(
        `7shifts query parameter ${name} must be a scalar or scalar array.`,
      );
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text))
      throw this.invalid(`7shifts query parameter ${name} is invalid.`);
    if (/^(limit|page_size|per_page)$/.test(name)) {
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < 1 || number > 100)
        throw this.invalid(
          `7shifts ${name} must be an integer from 1 through 100.`,
        );
    }
    return text;
  }

  private exactKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    for (const key of Object.keys(value))
      if (!allowed.includes(key))
        throw this.invalid(
          `7shifts ${label} parameter ${key} is not allowed for this operation.`,
        );
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 8)
      throw new SevenShiftsApiError(
        "policy_blocked",
        "7shifts request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new SevenShiftsApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(child, depth + 1);
    }
  }

  private requireCredentials(credentials: SevenShiftsCredentials) {
    for (const [label, value] of Object.entries(credentials))
      if (!value || value.length > 4_000 || /[\r\n]/.test(value))
        throw new SevenShiftsApiError(
          "credential_missing",
          `A valid 7shifts ${label} is required.`,
          401,
        );
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!text || text.length > 200 || !/^[A-Za-z0-9_.:-]+$/.test(text))
      throw this.invalid(`7shifts ${name} path parameter is invalid.`);
    return text;
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
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key|pin)/i.test(key)
            ? "[REDACTED]"
            : this.redact(child, depth + 1),
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
    return new SevenShiftsApiError("provider_validation_error", message);
  }
}
