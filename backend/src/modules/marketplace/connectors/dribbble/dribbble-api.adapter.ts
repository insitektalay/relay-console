import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  DRIBBBLE_OPERATION_BY_ID,
  type DribbbleOperation,
} from "./dribbble-operation-registry";

type JsonObject = Record<string, unknown>;
export type DribbbleInput = {
  path?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
  base64?: string;
  fileName?: string;
  mimeType?: string;
};

export class DribbbleApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DribbbleApiAdapter {
  private static readonly ORIGIN = "https://api.dribbble.com";

  health(token: string) {
    return this.read(token, "get-authenticated-user", {});
  }

  read(token: string, operationId: string, input: DribbbleInput) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("Dribbble read accepts GET operations only.");
    return this.request(token, operation, input);
  }

  manage(token: string, operationId: string, input: DribbbleInput) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid("Dribbble manage accepts mutation operations only.");
    return this.request(token, operation, input);
  }

  private async request(
    token: string,
    operation: DribbbleOperation,
    input: DribbbleInput,
  ) {
    const accessToken = this.credential(token);
    this.rejectSecrets(input);
    const url = new URL(
      `/v2${this.path(operation.path, input.path ?? {})}`,
      DribbbleApiAdapter.ORIGIN,
    );
    this.query(url.searchParams, input.query ?? {});
    if (
      url.origin !== DribbbleApiAdapter.ORIGIN ||
      !url.pathname.startsWith("/v2/")
    )
      throw new DribbbleApiError(
        "policy_blocked",
        "Dribbble request escaped the fixed v2 origin.",
        403,
      );
    let body: BodyInit | undefined;
    let contentType: string | undefined;
    if (operation.uploadField) {
      const base64 = this.text(input.base64, "base64", 12_000_000);
      const bytes = Buffer.from(base64, "base64");
      if (!bytes.length || bytes.byteLength > 8_000_000)
        throw this.invalid("Dribbble upload must be between 1 byte and 8 MB.");
      const mime = this.text(input.mimeType, "mimeType", 100);
      if (!/^image\/(jpeg|png|gif)$/i.test(mime))
        throw this.invalid("Dribbble upload must be GIF, JPEG, or PNG.");
      const name = this.text(input.fileName, "fileName", 250);
      if (/[\r\n/\\]/.test(name))
        throw this.invalid("Dribbble fileName is invalid.");
      const form = new FormData();
      form.set(
        operation.uploadField,
        new Blob([new Uint8Array(bytes)], { type: mime }),
        name,
      );
      for (const [key, value] of Object.entries(input.json ?? {}))
        this.formField(form, key, value);
      body = form;
    } else if (input.json !== undefined) {
      if (operation.method === "GET" || operation.method === "DELETE")
        throw this.invalid(
          `Dribbble ${operation.method} does not accept a body.`,
        );
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(input.json))
        this.formField(form, key, value);
      body = form.toString();
      if (Buffer.byteLength(body) > 1_000_000)
        throw this.invalid("Dribbble body exceeds 1 MB.");
      contentType = "application/x-www-form-urlencoded";
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(contentType ? { "Content-Type": contentType } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.method === "GET" ? 20_000 : 30_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.invalid("Dribbble response exceeds 5 MB.");
      const data = this.redact(this.parse(raw));
      if (!response.ok)
        throw new DribbbleApiError(
          this.code(response.status),
          this.message(data) ?? `Dribbble returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        location: response.headers.get("location"),
        pagination: response.headers.get("link"),
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          reset: response.headers.get("x-ratelimit-reset"),
        },
      };
    } catch (error) {
      if (error instanceof DribbbleApiError) throw error;
      throw new DribbbleApiError(
        "provider_unavailable",
        "Dribbble could not be reached.",
        502,
      );
    }
  }

  private operation(id: string) {
    const operation = DRIBBBLE_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid("Dribbble operation is not in the pinned registry.");
    return operation;
  }
  private path(template: string, values: JsonObject) {
    return template.replace(/\{([A-Za-z]+)\}/g, (_, key: string) =>
      encodeURIComponent(this.id(values[key], key)),
    );
  }
  private id(value: unknown, name: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!/^[1-9][0-9]{0,19}$/.test(text))
      throw this.invalid(`Dribbble ${name} is invalid.`);
    return text;
  }
  private query(params: URLSearchParams, query: JsonObject) {
    if (Object.keys(query).length > 20)
      throw this.invalid("Dribbble query has too many fields.");
    for (const [key, raw] of Object.entries(query)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,49}$/.test(key))
        throw this.invalid(`Dribbble query field ${key} is invalid.`);
      const value = String(raw ?? "");
      if (
        value.length > 2_000 ||
        /[\r\n]/.test(value) ||
        typeof raw === "object"
      )
        throw this.invalid(`Dribbble query field ${key} is invalid.`);
      if (value) params.set(key, value);
    }
    if (params.has("per_page")) {
      const count = Number(params.get("per_page"));
      if (!Number.isInteger(count) || count < 1 || count > 100)
        throw this.invalid("Dribbble per_page must be 1 through 100.");
    }
  }
  private formField(
    form: FormData | URLSearchParams,
    key: string,
    raw: unknown,
  ) {
    if (
      !/^[A-Za-z_][A-Za-z0-9_]{0,49}$/.test(key) ||
      /(token|secret|password|cookie|authorization)/i.test(key)
    )
      throw new DribbbleApiError(
        "policy_blocked",
        `Dribbble field ${key} is not allowed.`,
        403,
      );
    if (raw === undefined || raw === null) return;
    const values = Array.isArray(raw) ? raw : [raw];
    if (values.length > 20)
      throw this.invalid(`Dribbble field ${key} has too many values.`);
    for (const value of values) {
      if (typeof value === "object")
        throw this.invalid(`Dribbble field ${key} must be scalar.`);
      const text = String(value);
      if (text.length > 20_000 || /[\r\n]/.test(text))
        throw this.invalid(`Dribbble field ${key} is invalid.`);
      form.append(key, text);
    }
  }
  private credential(value: string) {
    const text = value?.trim();
    if (!text || text.length > 20_000 || /[\r\n]/.test(text))
      throw new DribbbleApiError(
        "credential_missing",
        "Dribbble access token is missing.",
        401,
      );
    return text;
  }
  private text(value: unknown, name: string, max: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > max)
      throw this.invalid(`Dribbble ${name} is invalid.`);
    return text;
  }
  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { response: raw.toString("utf8").slice(0, 100_000) };
    }
  }
  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 10)
      throw new DribbbleApiError(
        "policy_blocked",
        "Dribbble input is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((child) => this.rejectSecrets(child, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (/(token|secret|password|cookie|authorization|credential)/i.test(key))
        throw new DribbbleApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectSecrets(child, depth + 1);
    }
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 500).map((child) => this.redact(child, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 100_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|password|cookie|authorization)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown) {
    return value &&
      typeof value === "object" &&
      typeof (value as JsonObject).message === "string"
      ? String((value as JsonObject).message).slice(0, 500)
      : null;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new DribbbleApiError("provider_validation_error", message, 400);
  }
}
