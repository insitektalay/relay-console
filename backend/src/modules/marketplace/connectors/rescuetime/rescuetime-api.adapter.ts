import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  RESCUETIME_OPERATION_BY_ID,
  type RescueTimeOperation,
} from "./rescuetime-operation-registry";

type JsonObject = Record<string, unknown>;
export type RescueTimeOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
};

export class RescueTimeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RescueTimeApiAdapter {
  health(accessToken: string) {
    return this.directRequest(accessToken, "/api/resource/users", "GET");
  }

  read(accessToken: string, operationId: string, input: RescueTimeOperationInput) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET") throw this.invalid("RescueTime read accepts GET operations only.");
    return this.request(accessToken, operation, input);
  }

  manage(accessToken: string, operationId: string, input: RescueTimeOperationInput) {
    const operation = this.operation(operationId);
    if (operation.method === "GET") throw this.invalid("RescueTime manage accepts mutation operations only.");
    return this.request(accessToken, operation, input);
  }

  private async request(accessToken: string, operation: RescueTimeOperation, input: RescueTimeOperationInput) {
    this.rejectCredentialFields(input);
    let path = operation.path;
    const pathParameters = input.pathParameters ?? {};
    this.exactKeys(pathParameters, operation.pathParameters, "path");
    for (const name of operation.pathParameters) {
      path = path.replaceAll(`{${name}}`, encodeURIComponent(this.segment(pathParameters[name], name)));
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://")) {
      throw new RescueTimeApiError("policy_blocked", "RescueTime path escaped the pinned public API route.", 403);
    }
    const url = new URL(path, "https://www.rescuetime.com");
    const query = input.query ?? {};
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100) throw this.invalid(`RescueTime query ${name} has too many values.`);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        url.searchParams.append(name, this.scalar(item, name));
      }
    }
    for (const key of ["limit", "per_page", "page", "offset"]) {
      const value = url.searchParams.get(key);
      if (value && (!/^\d+$/.test(value) || Number(value) > 1000)) {
        throw this.invalid(`RescueTime ${key} must be an integer from 0 through 1000.`);
      }
    }
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed) throw this.invalid("This RescueTime operation does not accept a JSON body.");
    if (body && Buffer.byteLength(body) > 2_000_000) throw this.invalid("RescueTime request exceeds the 2 MB Relay limit.");
    return this.directRequest(accessToken, `${url.pathname}${url.search}`, operation.method, body);
  }

  private async directRequest(accessToken: string, target: string, method: string, body?: string) {
    if (!accessToken || accessToken.length > 8_000 || /[\r\n]/.test(accessToken)) {
      throw new RescueTimeApiError("credential_missing", "A valid RescueTime OAuth token is required.", 401);
    }
    const url = new URL(target, "https://www.rescuetime.com");
    if (
      url.origin !== "https://www.rescuetime.com" ||
      (!url.pathname.startsWith("/api/resource/") && !url.pathname.startsWith("/api/oauth/")) ||
      url.pathname === "/api/oauth/token"
    ) {
      throw new RescueTimeApiError("policy_blocked", "RescueTime requests must stay on the fixed HTTPS application API routes.", 403);
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
    } catch {
      throw new RescueTimeApiError("provider_unavailable", "RescueTime could not be reached.", 502);
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000) throw this.invalid("RescueTime response exceeds the 2.5 MB Relay limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new RescueTimeApiError(this.safeCode(response.status), this.errorMessage(data) ?? `RescueTime returned HTTP ${response.status}.`, response.status);
    }
    return data;
  }

  private operation(id: string) {
    const operation = RESCUETIME_OPERATION_BY_ID.get(id);
    if (!operation) throw this.invalid("RescueTime operation is not in the pinned official API contract.");
    return operation;
  }

  private exactKeys(value: JsonObject, allowed: readonly string[], label: string) {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) throw this.invalid(`RescueTime ${label} parameter ${key} is not allowed for this operation.`);
    }
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(text)) throw this.invalid(`RescueTime ${name} path parameter is invalid.`);
    return text;
  }

  private scalar(value: unknown, name: string) {
    if (typeof value === "object") throw this.invalid(`RescueTime query ${name} must be a scalar or scalar array.`);
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text)) throw this.invalid(`RescueTime query ${name} is invalid.`);
    return text;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10) throw new RescueTimeApiError("policy_blocked", "RescueTime request is too deeply nested.", 403);
    if (Array.isArray(value)) {
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) {
        throw new RescueTimeApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403);
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try { return JSON.parse(raw.toString("utf8")); }
    catch { return { message: raw.toString("utf8").slice(0, 2_000) }; }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value)) return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(Object.entries(value as JsonObject).map(([key, item]) => [
      key,
      /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1),
    ]));
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const object = value as JsonObject;
    for (const key of ["message", "error", "detail"]) {
      if (typeof object[key] === "string") return String(object[key]).slice(0, 500);
    }
    return null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }

  private invalid(message: string) { return new RescueTimeApiError("provider_validation_error", message, 400); }
}
