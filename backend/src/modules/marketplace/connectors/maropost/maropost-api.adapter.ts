import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  MAROPOST_OPERATION_BY_ID,
  type MaropostOperation,
} from "./maropost-operation-registry";

type JsonObject = Record<string, unknown>;
export type MaropostCredentials = { accountId: string; apiKey: string };
export type MaropostInput = {
  path?: JsonObject;
  query?: JsonObject;
  contact?: JsonObject;
  consentAttestation?: boolean;
};

@Injectable()
export class MaropostApiAdapter {
  health(credentials: MaropostCredentials) {
    return this.read(credentials, "list_campaigns", {
      query: { per_page: 10, page: 1, include_ab_child: "no" },
    });
  }

  read(
    credentials: MaropostCredentials,
    operationId: string,
    input: MaropostInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation("Maropost read accepts read operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: MaropostCredentials,
    operationId: string,
    input: MaropostInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation("Maropost manage accepts contact writes only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: MaropostCredentials,
    operation: MaropostOperation,
    input: MaropostInput,
  ) {
    const accountId = this.positiveInteger(credentials.accountId, "account ID");
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new MaropostApiError(
        "credential_missing",
        "Maropost API key is missing.",
      );
    this.rejectSecrets(input);
    if (operation.policy === "manage" && input.consentAttestation !== true)
      throw new MaropostApiError(
        "policy_blocked",
        "Maropost contact writes require explicit recorded contact authorization.",
      );

    const pathInput = input.path ?? {};
    if (
      Object.keys(pathInput).some(
        (key) => !operation.pathParameters.includes(key),
      )
    )
      throw this.validation("Maropost path parameter is not allowlisted.");
    let path = operation.path.replace("{accountId}", accountId);
    for (const key of operation.pathParameters) {
      const value = this.positiveInteger(pathInput[key], key);
      path = path.replace(`{${key}}`, value);
    }

    const queryInput = input.query ?? {};
    if (
      Object.keys(queryInput).some(
        (key) => !operation.queryParameters.includes(key),
      )
    )
      throw this.validation("Maropost query parameter is not allowlisted.");
    const url = new URL(path, this.origin(Number(accountId)));
    for (const [key, raw] of Object.entries(queryInput)) {
      if (raw == null || raw === "") continue;
      if (!["string", "number", "boolean"].includes(typeof raw))
        throw this.validation(`Maropost ${key} must be scalar.`);
      const value = String(raw);
      if (value.length > 500 || /[\u0000\r\n]/.test(value))
        throw this.validation(`Maropost ${key} is invalid.`);
      url.searchParams.set(key === "email" ? "contact[email]" : key, value);
    }
    this.validateQuery(operation.id, url.searchParams);

    let body: string | undefined;
    if (operation.policy === "manage") {
      const contact = this.contactBody(input.contact);
      body = JSON.stringify({ contact });
      if (Buffer.byteLength(body) > 64_000)
        throw this.validation("Maropost contact payload exceeds 64 KB.");
    } else if (input.contact !== undefined) {
      throw this.validation("Maropost read operations do not accept a body.");
    }

    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          authorization: `ApiKey ${apiKey}`,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.policy === "manage" ? 30_000 : 20_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Maropost response exceeds 1 MB.");
      const text = raw.toString("utf8");
      if (!response.ok)
        throw new MaropostApiError(
          this.safeCode(response.status),
          `Maropost returned HTTP ${response.status}.`,
          response.status,
        );
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw this.validation("Maropost returned invalid JSON.");
      }
      return {
        data: this.redact(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof MaropostApiError) throw error;
      throw new MaropostApiError(
        "provider_unavailable",
        "Maropost could not be reached.",
      );
    }
  }

  private validateQuery(operationId: string, query: URLSearchParams) {
    if (operationId === "list_campaigns") {
      const perPage = Number(query.get("per_page") ?? "10");
      const page = Number(query.get("page") ?? "1");
      if (!Number.isInteger(perPage) || perPage < 1 || perPage > 50)
        throw this.validation("Maropost per_page must be between 1 and 50.");
      if (!Number.isInteger(page) || page < 1 || page > 100)
        throw this.validation("Maropost page must be between 1 and 100.");
      const children = query.get("include_ab_child");
      if (children && !["yes", "no"].includes(children))
        throw this.validation("Maropost include_ab_child must be yes or no.");
      query.set("per_page", String(perPage));
      query.set("page", String(page));
    }
    if (operationId === "get_contact_by_email" && !query.has("contact[email]"))
      throw this.validation("Maropost contact lookup requires email.");
  }

  private contactBody(value: JsonObject | undefined) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.validation("Maropost contact is required.");
    const allowed = new Set([
      "email",
      "uid",
      "first_name",
      "last_name",
      "subscribe",
    ]);
    if (Object.keys(value).some((key) => !allowed.has(key)))
      throw new MaropostApiError(
        "policy_blocked",
        "Maropost contact field is not allowlisted.",
      );
    const contact: JsonObject = {};
    for (const [key, raw] of Object.entries(value)) {
      if (raw == null || raw === "") continue;
      if (key === "subscribe") {
        if (typeof raw !== "boolean")
          throw this.validation("Maropost subscribe must be boolean.");
        contact[key] = raw;
      } else {
        if (
          typeof raw !== "string" ||
          raw.length > 500 ||
          /[\u0000\r\n]/.test(raw)
        )
          throw this.validation(`Maropost ${key} is invalid.`);
        contact[key] = raw;
      }
    }
    if (
      typeof contact.email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(contact.email)
    )
      throw this.validation("Maropost contact requires a valid email address.");
    if (typeof contact.subscribe !== "boolean")
      throw this.validation(
        "Maropost contact requires explicit subscribe state.",
      );
    return contact;
  }

  private origin(accountId: number) {
    if (accountId >= 5000) return "https://api-ca1.maropost.com";
    if (accountId >= 4000) return "https://api-eu1.maropost.com";
    return "https://api.maropost.com";
  }

  private positiveInteger(value: unknown, label: string) {
    const normalized =
      typeof value === "number" ? String(value) : String(value ?? "").trim();
    if (!/^\d{1,12}$/.test(normalized) || Number(normalized) < 1)
      throw this.validation(`Maropost ${label} must be a positive integer.`);
    return normalized;
  }

  private operation(id: string) {
    const operation = MAROPOST_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new MaropostApiError(
        "tool_unavailable",
        "Maropost operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (
          /(api.?key|auth.?token|authorization|password|secret|cookie)/i.test(
            key,
          )
        )
          throw new MaropostApiError(
            "policy_blocked",
            "Credential-bearing Maropost input fields are blocked.",
          );
        if (/(url|uri|endpoint)$/i.test(key))
          throw new MaropostApiError(
            "policy_blocked",
            "Agent-supplied Maropost URLs are blocked.",
          );
        walk(child);
      }
    };
    walk(value);
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(api.?key|auth.?token|authorization|password|secret|cookie)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(child),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new MaropostApiError("provider_validation_error", message);
  }
}

export class MaropostApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
