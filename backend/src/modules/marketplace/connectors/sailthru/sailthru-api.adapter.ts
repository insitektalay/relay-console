import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  SAILTHRU_OPERATION_BY_ID,
  type SailthruOperation,
} from "./sailthru-operation-registry";

type JsonObject = Record<string, unknown>;
export type SailthruCredentials = {
  apiKey: string;
  apiSecret: string;
  healthList: string;
};
export type SailthruInput = {
  list?: unknown;
  email?: unknown;
  template?: unknown;
  subscribed?: unknown;
  optoutEmail?: unknown;
  consentAttestation?: boolean;
  doubleOptInAttestation?: boolean;
};

@Injectable()
export class SailthruApiAdapter {
  private static readonly ORIGIN = "https://api.sailthru.com";

  health(credentials: SailthruCredentials) {
    return this.read(credentials, "get_list", { list: credentials.healthList });
  }

  read(
    credentials: SailthruCredentials,
    operationId: string,
    input: SailthruInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation("Sailthru read accepts read operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: SailthruCredentials,
    operationId: string,
    input: SailthruInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation(
        "Sailthru manage accepts user preference writes only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: SailthruCredentials,
    operation: SailthruOperation,
    input: SailthruInput,
  ) {
    const apiKey = credentials.apiKey.trim();
    const apiSecret = credentials.apiSecret.trim();
    if (
      !apiKey ||
      !apiSecret ||
      apiKey.length > 500 ||
      apiSecret.length > 20_000
    )
      throw new SailthruApiError(
        "credential_missing",
        "Sailthru API credentials are missing.",
      );
    this.rejectSecrets(input);
    const payload = this.payload(operation.id, input);
    const json = JSON.stringify(payload);
    if (Buffer.byteLength(json) > 16_000)
      throw this.validation("Sailthru request exceeds 16 KB.");
    const format = "json";
    const sig = createHash("md5")
      .update(`${apiSecret}${apiKey}${format}${json}`)
      .digest("hex");
    const form = new URLSearchParams({ api_key: apiKey, sig, format, json });
    const url = new URL(`/${operation.endpoint}`, SailthruApiAdapter.ORIGIN);
    let body: string | undefined;
    if (operation.method === "GET") url.search = form.toString();
    else body = form.toString();

    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          ...(body
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
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
        throw this.validation("Sailthru response exceeds 1 MB.");
      const data = this.parseJson(raw);
      const providerError = Number(data.error);
      if (
        !response.ok ||
        (Number.isFinite(providerError) && providerError !== 0)
      )
        throw new SailthruApiError(
          providerError === 43
            ? "provider_rate_limited"
            : this.safeCode(response.status),
          response.ok
            ? "Sailthru rejected the operation."
            : `Sailthru returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: {
          limit: response.headers.get("x-rate-limit-limit"),
          remaining: response.headers.get("x-rate-limit-remaining"),
          reset: response.headers.get("x-rate-limit-reset"),
        },
      };
    } catch (error) {
      if (error instanceof SailthruApiError) throw error;
      throw new SailthruApiError(
        "provider_unavailable",
        "Sailthru could not be reached.",
      );
    }
  }

  private payload(operationId: string, input: SailthruInput): JsonObject {
    if (operationId === "get_list")
      return { list: this.text(input.list, "list", 200) };
    if (operationId === "get_template")
      return { template: this.text(input.template, "template", 200) };
    const email = this.email(input.email);
    if (operationId === "get_user")
      return {
        id: email,
        key: "email",
        fields: { keys: 1, lists: 1, optout_email: 1, vars: 1 },
      };
    if (input.consentAttestation !== true)
      throw new SailthruApiError(
        "policy_blocked",
        "Sailthru preference writes require explicit recorded contact authorization.",
      );
    if (operationId === "set_list_membership") {
      const subscribed = this.boolean(input.subscribed, "subscribed");
      if (subscribed && input.doubleOptInAttestation !== true)
        throw new SailthruApiError(
          "policy_blocked",
          "Sailthru subscription requires recorded double-opt-in evidence.",
        );
      return {
        id: email,
        key: "email",
        lists: { [this.text(input.list, "list", 200)]: subscribed ? 1 : 0 },
      };
    }
    const optout = this.text(input.optoutEmail, "optoutEmail", 10);
    if (!new Set(["all", "blast", "none"]).has(optout))
      throw this.validation("Sailthru optoutEmail is invalid.");
    if (optout === "none" && input.doubleOptInAttestation !== true)
      throw new SailthruApiError(
        "policy_blocked",
        "Sailthru opt-out removal requires recorded double-opt-in evidence.",
      );
    return { id: email, key: "email", optout_email: optout };
  }

  private parseJson(raw: Buffer): JsonObject {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object" && !Array.isArray(value))
        return value as JsonObject;
    } catch {
      // Normalize below.
    }
    throw this.validation("Sailthru returned invalid JSON.");
  }

  private email(value: unknown) {
    const email = typeof value === "string" ? value.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)
      throw this.validation("Sailthru requires a valid email address.");
    return email;
  }

  private text(value: unknown, label: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum || /[\u0000\r\n]/.test(text))
      throw this.validation(`Sailthru ${label} is invalid.`);
    return text;
  }

  private boolean(value: unknown, label: string) {
    if (typeof value !== "boolean")
      throw this.validation(`Sailthru ${label} must be boolean.`);
    return value;
  }

  private operation(id: string) {
    const operation = SAILTHRU_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new SailthruApiError(
        "tool_unavailable",
        "Sailthru operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value as JsonObject))
      if (
        /(api.?key|api.?secret|sig(nature)?|authorization|password|cookie|url|endpoint)/i.test(
          key,
        )
      )
        throw new SailthruApiError(
          "policy_blocked",
          "Credential-bearing or routing Sailthru input fields are blocked.",
        );
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
          /(api.?key|api.?secret|sig(nature)?|authorization|password|cookie)/i.test(
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
    return new SailthruApiError("provider_validation_error", message);
  }
}

export class SailthruApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
