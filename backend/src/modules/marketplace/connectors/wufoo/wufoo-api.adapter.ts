import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  WUFOO_OPERATION_BY_ID,
  type WufooOperation,
} from "./wufoo-operation-registry";

type JsonObject = Record<string, unknown>;
export type WufooCredentials = { apiKey: string; subdomain: string };
export type WufooOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  form?: JsonObject;
};

export class WufooApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WufooApiAdapter {
  health(credentials: WufooCredentials) {
    return this.directRequest(credentials, "/forms.json?limit=1&page=1", "GET");
  }

  async read(
    credentials: WufooCredentials,
    operationId: string,
    input: WufooOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.mutating) {
      throw this.invalid("Wufoo read accepts read-only operations only.");
    }
    return await this.request(credentials, operation, input);
  }

  async manage(
    credentials: WufooCredentials,
    operationId: string,
    input: WufooOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (!operation.mutating) {
      throw this.invalid("Wufoo manage accepts mutation operations only.");
    }
    return await this.request(credentials, operation, input);
  }

  private request(
    credentials: WufooCredentials,
    operation: WufooOperation,
    input: WufooOperationInput,
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
      throw new WufooApiError(
        "policy_blocked",
        "Wufoo path escaped the pinned API v3 route.",
        403,
      );
    }
    const query = this.query(input.query);
    const body = input.form ? this.form(input.form) : undefined;
    if (body && !operation.bodyAllowed) {
      throw this.invalid("This Wufoo operation does not accept form fields.");
    }
    return this.directRequest(
      credentials,
      `${path}${query}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    credentials: WufooCredentials,
    target: string,
    method: string,
    body?: string,
  ) {
    const apiKey = this.apiKey(credentials.apiKey);
    const subdomain = this.subdomain(credentials.subdomain);
    const root = new URL(`https://${subdomain}.wufoo.com/api/v3/`);
    const url = new URL(target.replace(/^\/+/, ""), root);
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new WufooApiError(
        "policy_blocked",
        "Wufoo requests must stay on the configured account's HTTPS API v3 origin.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:relayconsole`).toString("base64")}`,
          ...(body
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof WufooApiError) throw error;
      throw new WufooApiError(
        "provider_unavailable",
        "Wufoo could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 3_000_000) {
      throw this.invalid("Wufoo response exceeds the 3 MB Relay limit.");
    }
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new WufooApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Wufoo returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  private apiKey(value: string) {
    const key = value.trim();
    if (!key || key.length > 16_000 || /[\r\n:]/.test(key)) {
      throw new WufooApiError(
        "credential_missing",
        "A valid Wufoo API key is required.",
        401,
      );
    }
    return key;
  }

  private subdomain(value: string) {
    const subdomain = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.wufoo\.com\/?$/, "");
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
      throw this.invalid(
        "Wufoo account name must contain only letters, numbers, and internal hyphens.",
      );
    }
    return subdomain;
  }

  private query(value: JsonObject | undefined) {
    if (!value) return "";
    const entries = Object.entries(value);
    if (entries.length > 60) {
      throw this.invalid("Wufoo query contains too many fields.");
    }
    const params = new URLSearchParams();
    for (const [name, raw] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name)) {
        throw this.invalid(`Wufoo query parameter ${name} is invalid.`);
      }
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100) {
        throw this.invalid(`Wufoo query ${name} has too many values.`);
      }
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        if (typeof item === "object") {
          throw this.invalid(`Wufoo query ${name} must be scalar.`);
        }
        const text = String(item);
        if (text.length > 2_000 || /[\r\n]/.test(text)) {
          throw this.invalid(`Wufoo query ${name} is invalid.`);
        }
        params.append(name, text);
      }
    }
    const result = params.toString();
    return result ? `?${result}` : "";
  }

  private form(value: JsonObject) {
    const entries = Object.entries(value);
    if (entries.length > 250) {
      throw this.invalid("Wufoo form contains too many fields.");
    }
    const params = new URLSearchParams();
    for (const [name, raw] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name)) {
        throw this.invalid(`Wufoo form field ${name} is invalid.`);
      }
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 250) {
        throw this.invalid(`Wufoo form field ${name} has too many values.`);
      }
      for (const item of values) {
        if (item === null || item === undefined) continue;
        if (typeof item === "object") {
          throw this.invalid(`Wufoo form field ${name} must be scalar.`);
        }
        const text = String(item);
        if (text.length > 1_000_000 || /\u0000/.test(text)) {
          throw this.invalid(`Wufoo form field ${name} is too large.`);
        }
        params.append(name, text);
      }
    }
    const body = params.toString();
    if (Buffer.byteLength(body) > 2_000_000) {
      throw this.invalid("Wufoo request exceeds the 2 MB Relay limit.");
    }
    return body;
  }

  private exactPathKeys(value: JsonObject, allowed: readonly string[]) {
    const keys = Object.keys(value);
    if (
      keys.length !== allowed.length ||
      keys.some((key) => !allowed.includes(key))
    ) {
      throw this.invalid(
        "Wufoo path parameters must exactly match the selected operation.",
      );
    }
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,240}$/.test(text)) {
      throw this.invalid(`Wufoo ${name} path parameter is invalid.`);
    }
    return text;
  }

  private operation(id: string) {
    const item = WUFOO_OPERATION_BY_ID.get(id);
    if (!item) {
      throw this.invalid(
        "Wufoo operation is not in the pinned public API v3 contract.",
      );
    }
    return item;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 8) {
      throw new WufooApiError(
        "policy_blocked",
        "Wufoo request is too deeply nested.",
        403,
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 500) {
        throw this.invalid("Wufoo request contains too many array items.");
      }
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 500) {
      throw this.invalid("Wufoo request contains too many fields.");
    }
    for (const [key, item] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new WufooApiError(
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
    if (depth > 10) return "[truncated]";
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
          /(api.?key|token|secret|authorization|password|cookie|credential)/i.test(
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
    const candidate = body.message ?? body.error ?? body.ErrorText;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new WufooApiError("provider_validation_error", message, 400);
  }
}
