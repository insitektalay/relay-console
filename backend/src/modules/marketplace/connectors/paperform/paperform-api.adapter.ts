import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  PAPERFORM_OPERATION_BY_ID,
  type PaperformOperation,
} from "./paperform-operation-registry";

type JsonObject = Record<string, unknown>;
export type PaperformRegion = "us" | "au" | "eu";
export type PaperformCredentials = { apiKey: string; region: PaperformRegion };
export type PaperformOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: unknown;
};

const ROOTS: Record<PaperformRegion, string> = {
  us: "https://api.paperform.co/v1/",
  au: "https://api.au.paperform.co/v1/",
  eu: "https://api.eu.paperform.co/v1/",
};

export class PaperformApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PaperformApiAdapter {
  health(credentials: PaperformCredentials) {
    return this.directRequest(credentials, "/forms?limit=1", "GET");
  }

  read(
    credentials: PaperformCredentials,
    operationId: string,
    input: PaperformOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.mutating) {
      throw this.invalid("Paperform read accepts read-only operations only.");
    }
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: PaperformCredentials,
    operationId: string,
    input: PaperformOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (!operation.mutating) {
      throw this.invalid("Paperform manage accepts mutation operations only.");
    }
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: PaperformCredentials,
    operation: PaperformOperation,
    input: PaperformOperationInput,
  ) {
    this.rejectCredentialFields(input);
    let path = operation.path;
    const pathParameters = input.pathParameters ?? {};
    this.exactPathKeys(pathParameters, operation.pathParameters);
    for (const name of operation.pathParameters) {
      path = path.replaceAll(
        `{${name}}`,
        encodeURIComponent(this.segment(pathParameters[name], name)),
      );
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://")) {
      throw new PaperformApiError(
        "policy_blocked",
        "Paperform path escaped the pinned public API route.",
        403,
      );
    }
    const query = this.query(input.query);
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed) {
      throw this.invalid(
        "This Paperform operation does not accept a JSON body.",
      );
    }
    if (body && Buffer.byteLength(body) > 2_000_000) {
      throw this.invalid("Paperform request exceeds the 2 MB Relay limit.");
    }
    return this.directRequest(
      credentials,
      `${path}${query}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    credentials: PaperformCredentials,
    target: string,
    method: string,
    body?: string,
  ) {
    const apiKey = this.apiKey(credentials.apiKey);
    const root = new URL(ROOTS[credentials.region]);
    const url = new URL(target.replace(/^\/+/, ""), root);
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new PaperformApiError(
        "policy_blocked",
        "Paperform requests must stay on the selected fixed HTTPS API region.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof PaperformApiError) throw error;
      throw new PaperformApiError(
        "provider_unavailable",
        "Paperform could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000) {
      throw this.invalid("Paperform response exceeds the 2.5 MB Relay limit.");
    }
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new PaperformApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Paperform returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  private apiKey(value: string) {
    const key = value.trim().replace(/^Bearer\s+/i, "");
    if (!key || key.length > 16_000 || /[\r\n]/.test(key)) {
      throw new PaperformApiError(
        "credential_missing",
        "A valid Paperform API key is required.",
        401,
      );
    }
    return key;
  }

  private query(value: JsonObject | undefined) {
    if (!value) return "";
    const entries = Object.entries(value);
    if (entries.length > 100) {
      throw this.invalid("Paperform query contains too many fields.");
    }
    const params = new URLSearchParams();
    for (const [name, raw] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name)) {
        throw this.invalid(`Paperform query parameter ${name} is invalid.`);
      }
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100) {
        throw this.invalid(`Paperform query ${name} has too many values.`);
      }
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        if (typeof item === "object") {
          throw this.invalid(`Paperform query ${name} must be scalar.`);
        }
        const text = String(item);
        if (text.length > 2_000 || /[\r\n]/.test(text)) {
          throw this.invalid(`Paperform query ${name} is invalid.`);
        }
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
        "Paperform path parameters must exactly match the selected operation.",
      );
    }
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:@+~-]{1,240}$/.test(text)) {
      throw this.invalid(`Paperform ${name} path parameter is invalid.`);
    }
    return text;
  }

  private operation(id: string) {
    const item = PAPERFORM_OPERATION_BY_ID.get(id);
    if (!item) {
      throw this.invalid(
        "Paperform operation is not in the pinned public API contract.",
      );
    }
    return item;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12) {
      throw new PaperformApiError(
        "policy_blocked",
        "Paperform request is too deeply nested.",
        403,
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 2_000) {
        throw this.invalid("Paperform request contains too many array items.");
      }
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 2_000) {
      throw this.invalid("Paperform request contains too many fields.");
    }
    for (const [key, item] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new PaperformApiError(
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
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value)) {
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") {
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    }
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
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
    const candidate = body.message ?? body.error ?? body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new PaperformApiError("provider_validation_error", message, 400);
  }
}
