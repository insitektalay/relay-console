import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  FORMSTACK_OPERATION_BY_ID,
  type FormstackOperation,
} from "./formstack-operation-registry";

type JsonObject = Record<string, unknown>;
export type FormstackCredentials = { personalAccessToken: string };
export type FormstackOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: unknown;
};

export class FormstackApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FormstackApiAdapter {
  private readonly root = new URL("https://www.formstack.com/api/v2025/");

  health(credentials: FormstackCredentials) {
    return this.directRequest(
      credentials,
      "/forms?pageNumber=1&pageSize=10",
      "GET",
    );
  }

  read(
    credentials: FormstackCredentials,
    id: string,
    input: FormstackOperationInput,
  ) {
    const operation = this.operation(id);
    if (operation.mutating)
      throw this.invalid("Formstack read accepts read-only operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: FormstackCredentials,
    id: string,
    input: FormstackOperationInput,
  ) {
    const operation = this.operation(id);
    if (!operation.mutating)
      throw this.invalid("Formstack manage accepts mutation operations only.");
    return this.request(credentials, operation, input);
  }

  private request(
    credentials: FormstackCredentials,
    operation: FormstackOperation,
    input: FormstackOperationInput,
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
      throw new FormstackApiError(
        "policy_blocked",
        "Formstack path escaped the pinned V2025 API route.",
        403,
      );
    }
    const query = this.query(input.query);
    let body: string | undefined;
    if (operation.mutating && input.json !== undefined) {
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000)
        throw this.invalid("Formstack request exceeds Relay's 1 MB limit.");
    } else if (!operation.mutating && input.json !== undefined) {
      throw this.invalid(
        "Formstack read operations do not accept a JSON body.",
      );
    }
    return this.directRequest(
      credentials,
      `${path}${query}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    credentials: FormstackCredentials,
    target: string,
    method: string,
    body?: string,
  ) {
    const token = credentials.personalAccessToken
      .trim()
      .replace(/^Bearer\s+/i, "");
    if (
      !/^fs_pat_[A-Za-z0-9._~-]{8,16000}$/.test(token) ||
      /[\r\n]/.test(token)
    ) {
      throw new FormstackApiError(
        "credential_missing",
        "A valid fs_pat_ Formstack Personal Access Token is required.",
        401,
      );
    }
    const url = new URL(target.replace(/^\/+/, ""), this.root);
    if (
      url.protocol !== "https:" ||
      url.origin !== this.root.origin ||
      !url.pathname.startsWith(this.root.pathname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new FormstackApiError(
        "policy_blocked",
        "Formstack requests must stay on the fixed HTTPS V2025 API origin.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof FormstackApiError) throw error;
      throw new FormstackApiError(
        "provider_unavailable",
        "Formstack could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Formstack response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new FormstackApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Formstack returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  private query(value: JsonObject | undefined) {
    if (!value) return "";
    const entries = Object.entries(value);
    if (entries.length > 30)
      throw this.invalid("Formstack query contains too many fields.");
    const params = new URLSearchParams();
    for (const [name, raw] of entries) {
      if (
        !/^[A-Za-z][A-Za-z0-9_.\[\]-]{0,120}$/.test(name) ||
        /(token|secret|authorization|password|cookie|credential)/i.test(name)
      ) {
        throw this.invalid(`Formstack query parameter ${name} is not allowed.`);
      }
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`Formstack query ${name} has too many values.`);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        if (typeof item === "object")
          throw this.invalid(
            `Formstack query ${name} must be scalar or a repeated scalar.`,
          );
        let text = String(item);
        if (/^(pageSize|perPage)$/i.test(name)) {
          const limit = Number.parseInt(text, 10);
          if (!Number.isFinite(limit) || limit < 1)
            throw this.invalid(`Formstack ${name} must be a positive integer.`);
          text = String(Math.min(100, Math.max(10, limit)));
        }
        if (text.length > 2_000 || /[\r\n]/.test(text))
          throw this.invalid(`Formstack query ${name} is invalid.`);
        params.append(name, text);
      }
    }
    const result = params.toString();
    return result ? `?${result}` : "";
  }

  private exactPathKeys(value: JsonObject, allowed: readonly string[]) {
    const keys = Object.keys(value);
    if (
      keys.length !== allowed.length ||
      keys.some((key) => !allowed.includes(key))
    ) {
      throw this.invalid(
        "Formstack path parameters must exactly match the selected operation.",
      );
    }
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:@+~-]{1,240}$/.test(text))
      throw this.invalid(`Formstack ${name} path parameter is invalid.`);
    return text;
  }

  private operation(id: string) {
    const item = FORMSTACK_OPERATION_BY_ID.get(id);
    if (!item)
      throw this.invalid(
        "Formstack operation is not in the pinned official V2025 contract.",
      );
    return item;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12)
      throw new FormstackApiError(
        "policy_blocked",
        "Formstack request is too deeply nested.",
        403,
      );
    if (Array.isArray(value)) {
      if (value.length > 2_000)
        throw this.invalid("Formstack request contains too many array items.");
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new FormstackApiError(
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
        /(token|secret|authorization|password|cookie|credential|api.?key|encryption)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(item, depth + 1);
    }
    return output;
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const body = value as JsonObject;
    const candidate = body.message ?? body.error ?? body.detail;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new FormstackApiError("provider_validation_error", message, 400);
  }
}
