import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  ITERABLE_OPERATION_BY_ID,
  type IterableOperation,
} from "./iterable-operation-registry";

type JsonObject = Record<string, unknown>;
export type IterableCredentials = { apiKey: string; region: "us" | "eu" };
export type IterableInput = {
  pathParams?: JsonObject;
  query?: JsonObject;
  body?: JsonObject;
};

@Injectable()
export class IterableApiAdapter {
  private static readonly ORIGINS = {
    us: "https://api.iterable.com",
    eu: "https://api.eu.iterable.com",
  } as const;

  health(credentials: IterableCredentials) {
    return this.read(credentials, "list_channels", {});
  }

  read(
    credentials: IterableCredentials,
    operationId: string,
    input: IterableInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.validation("Iterable read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: IterableCredentials,
    operationId: string,
    input: IterableInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.validation(
        "Iterable manage accepts mutation operations only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: IterableCredentials,
    operation: IterableOperation,
    input: IterableInput,
  ) {
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new IterableApiError(
        "credential_missing",
        "Iterable server-side API key is missing.",
      );
    const origin = IterableApiAdapter.ORIGINS[credentials.region];
    if (!origin) throw this.validation("Iterable region must be us or eu.");
    this.rejectSecrets(input);
    const url = new URL(this.path(operation, input.pathParams ?? {}), origin);
    this.query(url.searchParams, operation, input.query ?? {});
    if (url.origin !== origin || !url.pathname.startsWith("/api/"))
      throw new IterableApiError(
        "policy_blocked",
        "Iterable request escaped the selected fixed data-center origin.",
      );
    let body: string | undefined;
    if (operation.body) {
      if (!input.body || typeof input.body !== "object")
        throw this.validation("Iterable operation requires a JSON body.");
      body = JSON.stringify(input.body);
      if (Buffer.byteLength(body) > 512_000)
        throw this.validation("Iterable request exceeds 512 KB.");
    } else if (input.body !== undefined)
      throw this.validation("Iterable operation does not accept a body.");
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          "Api-Key": apiKey,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.method === "GET" ? 20_000 : 30_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 3_000_000)
        throw this.validation("Iterable response exceeds 3 MB.");
      const data = this.redact(raw.length ? this.parse(raw) : {});
      if (!response.ok)
        throw new IterableApiError(
          this.safeCode(response.status),
          `Iterable returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof IterableApiError) throw error;
      throw new IterableApiError(
        "provider_unavailable",
        "Iterable could not be reached.",
      );
    }
  }

  private operation(id: string) {
    const operation = ITERABLE_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new IterableApiError(
        "tool_unavailable",
        "Iterable operation is not pinned.",
      );
    return operation;
  }

  private path(operation: IterableOperation, params: JsonObject) {
    const allowed = new Set(operation.pathParams ?? []);
    if (Object.keys(params).some((key) => !allowed.has(key)))
      throw this.validation("Iterable path parameters are not allowlisted.");
    let path = operation.path;
    for (const name of allowed) {
      const value = ["string", "number"].includes(typeof params[name])
        ? String(params[name]).trim()
        : "";
      if (!value || value.length > 320 || /[\r\n/]/.test(value))
        throw this.validation(`Iterable ${name} is invalid.`);
      path = path.replace(`{${name}}`, encodeURIComponent(value));
    }
    return path;
  }

  private query(
    params: URLSearchParams,
    operation: IterableOperation,
    query: JsonObject,
  ) {
    const allowed = new Set(operation.query ?? []);
    if (Object.keys(query).some((key) => !allowed.has(key)))
      throw this.validation("Iterable query field is not allowlisted.");
    for (const [key, raw] of Object.entries(query)) {
      if (raw == null || raw === "") continue;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 25)
        throw this.validation(`Iterable ${key} has too many values.`);
      for (const value of values) {
        if (!["string", "number", "boolean"].includes(typeof value))
          throw this.validation(`Iterable ${key} must be scalar.`);
        const text = String(value);
        if (text.length > 1_000 || /[\r\n]/.test(text))
          throw this.validation(`Iterable ${key} is invalid.`);
        params.append(key, text);
      }
    }
    this.firstPage(operation.id, params);
  }

  private firstPage(operationId: string, params: URLSearchParams) {
    if (
      ["list_campaigns", "list_journeys", "list_templates"].includes(
        operationId,
      )
    ) {
      if (!params.has("page")) params.set("page", "1");
      if (!params.has("pageSize")) params.set("pageSize", "50");
      if (
        Number(params.get("page")) !== 1 ||
        !this.integerInRange(params.get("pageSize"), 1, 100)
      )
        throw this.validation(
          "Iterable paged reads are fixed to page one and at most 100 records.",
        );
    }
    if (operationId === "list_experiments") {
      if (!params.has("offset")) params.set("offset", "0");
      if (!params.has("limit")) params.set("limit", "50");
      if (
        Number(params.get("offset")) !== 0 ||
        !this.integerInRange(params.get("limit"), 1, 100)
      )
        throw this.validation(
          "Iterable experiment reads are fixed to the first 100 records.",
        );
    }
    if (
      ["get_events_by_email", "get_events_by_id", "get_sent_messages"].includes(
        operationId,
      )
    ) {
      if (!params.has("limit")) params.set("limit", "50");
      if (!this.integerInRange(params.get("limit"), 1, 200))
        throw this.validation(
          "Iterable user history reads allow at most 200 records.",
        );
    }
  }

  private integerInRange(value: string | null, min: number, max: number) {
    return (
      !!value &&
      /^\d+$/.test(value) &&
      Number(value) >= min &&
      Number(value) <= max
    );
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (
          /(api.?key|jwt|token|password|secret|authorization|cookie)/i.test(key)
        )
          throw new IterableApiError(
            "policy_blocked",
            "Credential-bearing Iterable input fields are blocked.",
          );
        if (/(url|uri|endpoint)$/i.test(key) && typeof child === "string") {
          let url: URL;
          try {
            url = new URL(child);
          } catch {
            throw this.validation(`Iterable ${key} must be an absolute URL.`);
          }
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            [...url.searchParams.keys()].some((name) =>
              /(key|token|secret|password|auth)/i.test(name),
            )
          )
            throw new IterableApiError(
              "policy_blocked",
              "Credential-bearing or non-HTTPS Iterable URLs are blocked.",
            );
        }
        walk(child);
      }
    };
    walk(value);
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 20_000) : value;
    const out: JsonObject = {};
    for (const [key, entry] of Object.entries(value as JsonObject).slice(
      0,
      500,
    ))
      out[key] =
        /(api.?key|jwt|token|password|secret|authorization|cookie)/i.test(key)
          ? "[REDACTED]"
          : this.redact(entry);
    return out;
  }

  private parse(raw: Buffer): unknown {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      throw this.validation("Iterable returned invalid JSON.");
    }
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new IterableApiError("provider_validation_error", message);
  }
}

export class IterableApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
