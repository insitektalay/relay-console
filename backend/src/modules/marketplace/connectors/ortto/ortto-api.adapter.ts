import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  ORTTO_OPERATION_BY_ID,
  type OrttoOperation,
} from "./ortto-operation-registry";

type JsonObject = Record<string, unknown>;
export type OrttoCredentials = {
  apiKey: string;
  region: "default" | "au" | "eu";
};
export type OrttoInput = {
  body?: JsonObject;
  consentAttestation?: boolean;
};

@Injectable()
export class OrttoApiAdapter {
  private static readonly ORIGINS = {
    default: "https://api.ap3api.com",
    au: "https://api.au.ap3api.com",
    eu: "https://api.eu.ap3api.com",
  } as const;

  health(credentials: OrttoCredentials) {
    return this.read(credentials, "get_instance_schema", {
      body: { namespaces: ["cm"] },
    });
  }

  read(credentials: OrttoCredentials, operationId: string, input: OrttoInput) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation("Ortto read accepts read operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: OrttoCredentials,
    operationId: string,
    input: OrttoInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation("Ortto manage accepts mutation operations only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: OrttoCredentials,
    operation: OrttoOperation,
    input: OrttoInput,
  ) {
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new OrttoApiError(
        "credential_missing",
        "Ortto custom API key is missing.",
      );
    const origin = OrttoApiAdapter.ORIGINS[credentials.region];
    if (!origin)
      throw this.validation("Ortto region must be default, au, or eu.");
    this.rejectSecrets(input);
    const url = new URL(operation.path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/v1/") || url.search)
      throw new OrttoApiError(
        "policy_blocked",
        "Ortto request escaped the selected fixed regional v1 origin.",
      );
    const prepared = this.prepareBody(operation, input);
    const body = prepared === undefined ? undefined : JSON.stringify(prepared);
    if (body && Buffer.byteLength(body) > 512_000)
      throw this.validation("Ortto request exceeds 512 KB.");
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          "X-Api-Key": apiKey,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.policy === "manage" ? 30_000 : 20_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 3_000_000)
        throw this.validation("Ortto response exceeds 3 MB.");
      const data = this.redact(raw.length ? this.parse(raw) : {});
      if (!response.ok)
        throw new OrttoApiError(
          this.safeCode(response.status),
          `Ortto returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof OrttoApiError) throw error;
      throw new OrttoApiError(
        "provider_unavailable",
        "Ortto could not be reached.",
      );
    }
  }

  private prepareBody(operation: OrttoOperation, input: OrttoInput) {
    if (operation.body === "none") {
      if (input.body !== undefined)
        throw this.validation("Ortto operation does not accept a body.");
      return undefined;
    }
    if (
      operation.body === "required" &&
      (!input.body || typeof input.body !== "object")
    )
      throw this.validation("Ortto operation requires a JSON body.");
    const body: JsonObject = { ...(input.body ?? {}) };
    this.bound(operation.id, body, input.consentAttestation === true);
    return body;
  }

  private bound(operationId: string, body: JsonObject, consent: boolean) {
    const firstPage = (max: number) => {
      body.limit ??= 50;
      body.offset ??= 0;
      if (!this.integerInRange(body.limit, 1, max) || body.offset !== 0)
        throw this.validation(
          `Ortto ${operationId} is fixed to offset zero and at most ${max} records.`,
        );
    };
    if (["list_audiences", "get_people", "get_accounts"].includes(operationId))
      firstPage(100);
    if (operationId === "list_reports") firstPage(100);
    const arrays: Record<string, string> = {
      get_subscriptions: "people",
      merge_people: "people",
      merge_accounts: "accounts",
      update_audience_subscription: "people",
      create_person_activities: "activities",
      create_account_activities: "activities",
      send_transactional_email: "emails",
      send_transactional_push: "pushes",
    };
    const arrayName = arrays[operationId];
    if (arrayName) {
      const values = body[arrayName];
      if (!Array.isArray(values) || values.length < 1 || values.length > 25)
        throw this.validation(
          `Ortto ${operationId} requires 1 to 25 ${arrayName}.`,
        );
    }
    if (operationId === "update_audience_subscription") {
      const optIn = (body.people as unknown[]).some(
        (person) =>
          !!person &&
          typeof person === "object" &&
          ((person as JsonObject).subscribed === true ||
            (person as JsonObject).sms_opted_in === true),
      );
      if (optIn && !consent)
        throw new OrttoApiError(
          "policy_blocked",
          "Ortto audience opt-in requires an explicit recorded consent attestation.",
        );
    }
    if (
      operationId === "send_transactional_email" &&
      this.hasKey(body, "attachments")
    )
      throw new OrttoApiError(
        "policy_blocked",
        "Ortto transactional attachments are not agent-facing.",
      );
    if (operationId === "get_report" && body.refresh === true)
      throw new OrttoApiError(
        "policy_blocked",
        "Ortto report reads cannot force a provider-side refresh.",
      );
  }

  private operation(id: string) {
    const operation = ORTTO_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new OrttoApiError(
        "tool_unavailable",
        "Ortto operation is not pinned.",
      );
    return operation;
  }

  private integerInRange(value: unknown, min: number, max: number) {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max
    );
  }

  private hasKey(value: unknown, sought: string): boolean {
    if (Array.isArray(value))
      return value.some((entry) => this.hasKey(entry, sought));
    if (!value || typeof value !== "object") return false;
    return Object.entries(value as JsonObject).some(
      ([key, child]) => key === sought || this.hasKey(child, sought),
    );
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (/(api.?key|token|password|secret|authorization|cookie)/i.test(key))
          throw new OrttoApiError(
            "policy_blocked",
            "Credential-bearing Ortto input fields are blocked.",
          );
        if (
          /(url|uri|endpoint|link|image)$/i.test(key) &&
          typeof child === "string"
        ) {
          let url: URL;
          try {
            url = new URL(child);
          } catch {
            throw this.validation(`Ortto ${key} must be an absolute URL.`);
          }
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            [...url.searchParams.keys()].some((name) =>
              /(key|token|secret|password|auth)/i.test(name),
            )
          )
            throw new OrttoApiError(
              "policy_blocked",
              "Credential-bearing or non-HTTPS Ortto URLs are blocked.",
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
      out[key] = /(api.?key|token|password|secret|authorization|cookie)/i.test(
        key,
      )
        ? "[REDACTED]"
        : this.redact(entry);
    return out;
  }

  private parse(raw: Buffer): unknown {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      throw this.validation("Ortto returned invalid JSON.");
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
    return new OrttoApiError("provider_validation_error", message);
  }
}

export class OrttoApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
