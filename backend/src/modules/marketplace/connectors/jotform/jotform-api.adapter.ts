import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  JOTFORM_OPERATION_BY_ID,
  type JotformOperation,
} from "./jotform-operation-registry";

type JsonObject = Record<string, unknown>;
export type JotformRegion = "standard" | "eu" | "hipaa";
export type JotformCredentials = { apiKey: string; region: JotformRegion };
export type JotformOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  form?: JsonObject;
  json?: unknown;
};

const ROOTS: Record<JotformRegion, string> = {
  standard: "https://api.jotform.com/",
  eu: "https://eu-api.jotform.com/",
  hipaa: "https://hipaa-api.jotform.com/",
};

export class JotformApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class JotformApiAdapter {
  health(credentials: JotformCredentials) {
    return this.directRequest(credentials, "/user", "GET");
  }

  read(
    credentials: JotformCredentials,
    operationId: string,
    input: JotformOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.mutating) {
      throw this.invalid("Jotform read accepts read-only operations only.");
    }
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: JotformCredentials,
    operationId: string,
    input: JotformOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (!operation.mutating) {
      throw this.invalid("Jotform manage accepts mutation operations only.");
    }
    return this.request(credentials, operation, input);
  }

  private request(
    credentials: JotformCredentials,
    operation: JotformOperation,
    input: JotformOperationInput,
  ) {
    this.rejectCredentialFields(input);
    let path = operation.path;
    const parameters = input.pathParameters ?? {};
    this.exactPathKeys(parameters, operation.pathParameters);
    for (const name of operation.pathParameters) {
      path = path.replaceAll(
        `{${name}}`,
        encodeURIComponent(this.segment(parameters[name], name)),
      );
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://")) {
      throw new JotformApiError(
        "policy_blocked",
        "Jotform path escaped the pinned public API route.",
        403,
      );
    }
    const query = this.query(input.query);
    let body: string | undefined;
    let contentType: string | undefined;
    if (operation.bodyMode === "form") {
      if (input.json !== undefined) {
        throw this.invalid(
          "This Jotform operation accepts form fields, not raw JSON.",
        );
      }
      body = this.form(input.form);
      contentType = "application/x-www-form-urlencoded";
    } else if (operation.bodyMode === "json") {
      if (input.form !== undefined) {
        throw this.invalid(
          "This Jotform operation accepts JSON, not form fields.",
        );
      }
      if (input.json === undefined) {
        throw this.invalid("This Jotform operation requires a JSON body.");
      }
      body = JSON.stringify(input.json);
      contentType = "application/json";
    } else if (input.form !== undefined || input.json !== undefined) {
      throw this.invalid(
        "This Jotform operation does not accept a request body.",
      );
    }
    if (body && Buffer.byteLength(body) > 1_000_000) {
      throw this.invalid("Jotform request exceeds Relay's 1 MB limit.");
    }
    return this.directRequest(
      credentials,
      `${path}${query}`,
      operation.method,
      body,
      contentType,
    );
  }

  private async directRequest(
    credentials: JotformCredentials,
    target: string,
    method: string,
    body?: string,
    contentType?: string,
  ) {
    const apiKey = this.apiKey(credentials.apiKey);
    const root = new URL(ROOTS[credentials.region]);
    const url = new URL(target.replace(/^\/+/, ""), root);
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new JotformApiError(
        "policy_blocked",
        "Jotform requests must stay on the selected fixed HTTPS API region.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          APIKEY: apiKey,
          ...(contentType ? { "Content-Type": contentType } : {}),
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof JotformApiError) throw error;
      throw new JotformApiError(
        "provider_unavailable",
        "Jotform could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000) {
      throw this.invalid("Jotform response exceeds Relay's 2.5 MB limit.");
    }
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new JotformApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Jotform returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  private apiKey(value: string) {
    const key = value.trim();
    if (!key || key.length > 16_000 || /[\r\n]/.test(key)) {
      throw new JotformApiError(
        "credential_missing",
        "A valid Jotform API key is required.",
        401,
      );
    }
    return key;
  }

  private query(value: JsonObject | undefined) {
    if (!value) return "";
    const entries = Object.entries(value);
    if (entries.length > 24) {
      throw this.invalid("Jotform query contains too many fields.");
    }
    const params = new URLSearchParams();
    for (const [name, raw] of entries) {
      this.fieldName(name, "query parameter");
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100) {
        throw this.invalid(`Jotform query ${name} has too many values.`);
      }
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        if (typeof item === "object") {
          const text = JSON.stringify(item);
          if (text.length > 10_000) {
            throw this.invalid(`Jotform query ${name} is too large.`);
          }
          params.append(name, text);
        } else {
          let text = String(item);
          if (name === "limit") {
            const limit = Number.parseInt(text, 10);
            if (!Number.isFinite(limit) || limit < 1) {
              throw this.invalid("Jotform limit must be a positive integer.");
            }
            text = String(Math.min(limit, 100));
          }
          if (text.length > 2_000 || /[\r\n]/.test(text)) {
            throw this.invalid(`Jotform query ${name} is invalid.`);
          }
          params.append(name, text);
        }
      }
    }
    const result = params.toString();
    return result ? `?${result}` : "";
  }

  private form(value: JsonObject | undefined) {
    if (!value) return "";
    const entries = Object.entries(value);
    if (entries.length > 1_000) {
      throw this.invalid("Jotform form body contains too many fields.");
    }
    const body = new URLSearchParams();
    for (const [name, raw] of entries) {
      this.fieldName(name, "form field", true);
      if (raw === null || raw === undefined) continue;
      if (typeof raw === "object") {
        throw this.invalid(
          `Jotform form field ${name} must be flattened or sent through a JSON operation.`,
        );
      }
      const text = String(raw);
      if (text.length > 100_000 || /[\u0000]/.test(text)) {
        throw this.invalid(`Jotform form field ${name} is invalid.`);
      }
      body.append(name, text);
    }
    return body.toString();
  }

  private fieldName(name: string, label: string, brackets = false) {
    const pattern = brackets
      ? /^[A-Za-z][A-Za-z0-9_.-]*(?:\[[A-Za-z0-9_.-]+\]){0,4}$/
      : /^[A-Za-z][A-Za-z0-9_.-]{0,99}$/;
    if (
      !pattern.test(name) ||
      /(api.?key|authorization|token|secret|password|cookie|credential)/i.test(
        name,
      )
    ) {
      throw this.invalid(`Jotform ${label} ${name} is not allowed.`);
    }
  }

  private exactPathKeys(value: JsonObject, allowed: readonly string[]) {
    const keys = Object.keys(value);
    if (
      keys.length !== allowed.length ||
      keys.some((key) => !allowed.includes(key))
    ) {
      throw this.invalid(
        "Jotform path parameters must exactly match the selected operation.",
      );
    }
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:@+~-]{1,240}$/.test(text)) {
      throw this.invalid(`Jotform ${name} path parameter is invalid.`);
    }
    return text;
  }

  private operation(id: string) {
    const item = JOTFORM_OPERATION_BY_ID.get(id);
    if (!item) {
      throw this.invalid(
        "Jotform operation is not in the pinned public API contract.",
      );
    }
    return item;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12) {
      throw new JotformApiError(
        "policy_blocked",
        "Jotform request is too deeply nested.",
        403,
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 2_000) {
        throw this.invalid("Jotform request contains too many array items.");
      }
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 2_000) {
      throw this.invalid("Jotform request contains too many fields.");
    }
    for (const [key, item] of entries) {
      if (
        /(api.?key|authorization|token|secret|password|cookie|credential)/i.test(
          key,
        )
      ) {
        throw new JotformApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      }
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
    if (depth > 12) return "[TRUNCATED]";
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject).slice(
      0,
      2_000,
    )) {
      output[key] =
        /(api.?key|authorization|token|secret|password|cookie|credential)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(item, depth + 1);
    }
    return output;
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const object = value as JsonObject;
    for (const key of ["message", "error", "error_description"]) {
      if (typeof object[key] === "string") return object[key].slice(0, 500);
    }
    return null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new JotformApiError("provider_validation_error", message, 400);
  }
}
