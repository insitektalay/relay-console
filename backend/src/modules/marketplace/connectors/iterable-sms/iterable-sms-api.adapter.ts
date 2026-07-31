import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  ITERABLE_SMS_OPERATION_BY_ID,
  type IterableSmsOperation,
} from "./iterable-sms-operation-registry";

type JsonObject = Record<string, unknown>;
export type IterableSmsCredentials = { apiKey: string; region: "us" | "eu" };
export type IterableSmsInput = {
  query?: JsonObject;
  body?: JsonObject;
  consentAttestation?: boolean;
};

@Injectable()
export class IterableSmsApiAdapter {
  private static readonly ORIGINS = {
    us: "https://api.iterable.com",
    eu: "https://api.eu.iterable.com",
  } as const;

  health(credentials: IterableSmsCredentials) {
    return this.read(credentials, "list_channels", {});
  }

  read(
    credentials: IterableSmsCredentials,
    operationId: string,
    input: IterableSmsInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.validation("Iterable SMS read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: IterableSmsCredentials,
    operationId: string,
    input: IterableSmsInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "POST")
      throw this.validation(
        "Iterable SMS manage accepts POST operations only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: IterableSmsCredentials,
    operation: IterableSmsOperation,
    input: IterableSmsInput,
  ) {
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new IterableSmsApiError(
        "credential_missing",
        "Iterable SMS server-side API key is missing.",
      );
    const origin = IterableSmsApiAdapter.ORIGINS[credentials.region];
    if (!origin) throw this.validation("Iterable SMS region must be us or eu.");
    if (operation.consentAttestation && input.consentAttestation !== true)
      throw new IterableSmsApiError(
        "policy_blocked",
        "Iterable SMS operation requires an explicit recorded consent attestation.",
      );
    this.rejectSecrets(input);
    const url = new URL(operation.path, origin);
    this.query(url.searchParams, operation, input.query ?? {});
    if (url.origin !== origin || !url.pathname.startsWith("/api/"))
      throw new IterableSmsApiError(
        "policy_blocked",
        "Iterable SMS request escaped the selected data-center origin.",
      );
    let body: string | undefined;
    if (operation.body) {
      if (!input.body || typeof input.body !== "object")
        throw this.validation("Iterable SMS operation requires a JSON body.");
      this.validateBody(operation.id, input.body);
      body = JSON.stringify(input.body);
      if (Buffer.byteLength(body) > 256_000)
        throw this.validation("Iterable SMS request exceeds 256 KB.");
    } else if (input.body !== undefined)
      throw this.validation("Iterable SMS read does not accept a body.");
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
      if (raw.byteLength > 2_000_000)
        throw this.validation("Iterable SMS response exceeds 2 MB.");
      const data = this.redact(raw.length ? this.parse(raw) : {});
      if (!response.ok)
        throw new IterableSmsApiError(
          this.safeCode(response.status),
          `Iterable SMS returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof IterableSmsApiError) throw error;
      throw new IterableSmsApiError(
        "provider_unavailable",
        "Iterable SMS could not be reached.",
      );
    }
  }

  private operation(id: string) {
    const operation = ITERABLE_SMS_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new IterableSmsApiError(
        "tool_unavailable",
        "Iterable SMS operation is not pinned.",
      );
    return operation;
  }

  private query(
    params: URLSearchParams,
    operation: IterableSmsOperation,
    query: JsonObject,
  ) {
    const allowed = new Set(operation.query ?? []);
    if (Object.keys(query).some((key) => !allowed.has(key)))
      throw this.validation("Iterable SMS query field is not allowlisted.");
    for (const [key, raw] of Object.entries(query)) {
      if (raw == null || raw === "") continue;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 25)
        throw this.validation(`Iterable SMS ${key} has too many values.`);
      for (const value of values) {
        if (!["string", "number", "boolean"].includes(typeof value))
          throw this.validation(`Iterable SMS ${key} must be scalar.`);
        const text = String(value);
        if (text.length > 1_000 || /[\r\n]/.test(text))
          throw this.validation(`Iterable SMS ${key} is invalid.`);
        params.append(key, text);
      }
    }
    if (operation.id === "list_sms_templates") {
      params.set("messageMedium", "SMS");
      params.set("page", "1");
      params.set("pageSize", "50");
      params.set("sort", "id");
    }
    if (operation.id === "get_sms_sent_messages") {
      params.set("messageMedium", "SMS");
      if (!params.has("limit")) params.set("limit", "50");
      const limit = params.get("limit");
      if (
        !limit ||
        !/^\d+$/.test(limit) ||
        Number(limit) < 1 ||
        Number(limit) > 200
      )
        throw this.validation(
          "Iterable SMS sent-message reads allow at most 200 records.",
        );
    }
  }

  private validateBody(operationId: string, body: JsonObject) {
    if (operationId !== "update_sms_user") return;
    const allowed = new Set([
      "email",
      "userId",
      "mergeNestedObjects",
      "preferUserId",
      "dataFields",
    ]);
    if (Object.keys(body).some((key) => !allowed.has(key)))
      throw this.validation(
        "Iterable SMS user update accepts identity and phoneNumber fields only.",
      );
    const dataFields = body.dataFields;
    if (
      !dataFields ||
      typeof dataFields !== "object" ||
      Array.isArray(dataFields)
    )
      throw this.validation(
        "Iterable SMS user update requires dataFields.phoneNumber.",
      );
    const fields = dataFields as JsonObject;
    if (
      Object.keys(fields).some((key) => key !== "phoneNumber") ||
      typeof fields.phoneNumber !== "string" ||
      !/^\+[1-9]\d{7,14}$/.test(fields.phoneNumber)
    )
      throw this.validation("Iterable SMS phoneNumber must be E.164.");
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (
          /(api.?key|jwt|token|password|secret|authorization|cookie)/i.test(key)
        )
          throw new IterableSmsApiError(
            "policy_blocked",
            "Credential-bearing Iterable SMS input fields are blocked.",
          );
        if (/(url|uri|endpoint)$/i.test(key) && typeof child === "string") {
          let url: URL;
          try {
            url = new URL(child);
          } catch {
            throw this.validation(
              `Iterable SMS ${key} must be an absolute URL.`,
            );
          }
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            [...url.searchParams.keys()].some((name) =>
              /(key|token|secret|password|auth)/i.test(name),
            )
          )
            throw new IterableSmsApiError(
              "policy_blocked",
              "Credential-bearing or non-HTTPS Iterable SMS URLs are blocked.",
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
      throw this.validation("Iterable SMS returned invalid JSON.");
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
    return new IterableSmsApiError("provider_validation_error", message);
  }
}

export class IterableSmsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
