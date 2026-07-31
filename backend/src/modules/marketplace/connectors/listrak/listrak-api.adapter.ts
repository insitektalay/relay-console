import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  LISTRAK_OPERATION_BY_ID,
  type ListrakOperation,
} from "./listrak-operation-registry";

type JsonObject = Record<string, unknown>;
export type ListrakCredentials = { clientId: string; clientSecret: string };
export type ListrakInput = {
  listId?: unknown;
  email?: unknown;
  subscriptionState?: unknown;
  externalContactId?: unknown;
  consentAttestation?: boolean;
  doubleOptInAttestation?: boolean;
};

@Injectable()
export class ListrakApiAdapter {
  private static readonly API_ORIGIN = "https://api.listrak.com";
  private static readonly TOKEN_URL = "https://auth.listrak.com/OAuth2/Token";
  private readonly tokens = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  health(credentials: ListrakCredentials) {
    return this.read(credentials, "list_lists", {});
  }

  read(
    credentials: ListrakCredentials,
    operationId: string,
    input: ListrakInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation("Listrak read accepts read operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: ListrakCredentials,
    operationId: string,
    input: ListrakInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation("Listrak manage accepts one-contact writes only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: ListrakCredentials,
    operation: ListrakOperation,
    input: ListrakInput,
  ) {
    this.rejectSecrets(input);
    let path = operation.path;
    if (path.includes("{listId}"))
      path = path.replace(
        "{listId}",
        this.positiveInteger(input.listId, "listId"),
      );
    if (path.includes("{email}"))
      path = path.replace(
        "{email}",
        encodeURIComponent(this.email(input.email)),
      );
    const url = new URL(path, ListrakApiAdapter.API_ORIGIN);
    let body: string | undefined;
    if (operation.policy === "manage") {
      if (input.consentAttestation !== true)
        throw new ListrakApiError(
          "policy_blocked",
          "Listrak contact writes require explicit recorded contact authorization.",
        );
      const state = this.text(input.subscriptionState, "subscriptionState", 20);
      if (!new Set(["Subscribed", "Unsubscribed"]).has(state))
        throw this.validation("Listrak subscriptionState is invalid.");
      if (state === "Subscribed" && input.doubleOptInAttestation !== true)
        throw new ListrakApiError(
          "policy_blocked",
          "Listrak subscription requires recorded double-opt-in evidence.",
        );
      const contact: JsonObject = {
        emailAddress: this.email(input.email),
        subscriptionState: state,
        segmentationFieldValues: [],
      };
      const external = this.optionalText(
        input.externalContactId,
        "externalContactId",
        200,
      );
      if (external) contact.externalContactID = external;
      body = JSON.stringify(contact);
      url.searchParams.set("overrideUnsubscribe", "false");
      url.searchParams.set(
        "subscribedByContact",
        state === "Subscribed" ? "true" : "false",
      );
      url.searchParams.set(
        "sendDoubleOptIn",
        state === "Subscribed" ? "true" : "false",
      );
      url.searchParams.set("updateType", "Update");
    }
    const token = await this.accessToken(credentials);
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
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
      if (raw.byteLength > 1_000_000)
        throw this.validation("Listrak response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new ListrakApiError(
          this.safeCode(response.status),
          `Listrak returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof ListrakApiError) throw error;
      throw new ListrakApiError(
        "provider_unavailable",
        "Listrak could not be reached.",
      );
    }
  }

  private async accessToken(credentials: ListrakCredentials) {
    const clientId = credentials.clientId.trim();
    const clientSecret = credentials.clientSecret.trim();
    if (
      !clientId ||
      !clientSecret ||
      clientId.length > 500 ||
      clientSecret.length > 20_000
    )
      throw new ListrakApiError(
        "credential_missing",
        "Listrak client credentials are missing.",
      );
    const key = createHash("sha256")
      .update(`${clientId}\0${clientSecret}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    let response: Response;
    try {
      response = await safeConnectorFetch(ListrakApiAdapter.TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ListrakApiError(
        "token_refresh_failed",
        "Listrak token exchange failed.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 64_000)
      throw new ListrakApiError(
        "token_refresh_failed",
        "Listrak token response is invalid.",
      );
    const data = this.parseJson(raw);
    const token =
      typeof data.access_token === "string" ? data.access_token : "";
    const expiresIn = Number(data.expires_in);
    if (!response.ok || !token || !Number.isFinite(expiresIn) || expiresIn < 1)
      throw new ListrakApiError(
        "token_refresh_failed",
        "Listrak did not return a usable access token.",
        response.status,
      );
    this.tokens.set(key, {
      token,
      expiresAt: Date.now() + Math.min(expiresIn, 32_400) * 1_000,
    });
    return token;
  }

  private parseJson(raw: Buffer): JsonObject {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object" && !Array.isArray(value))
        return value as JsonObject;
    } catch {
      /* normalize */
    }
    throw this.validation("Listrak returned invalid JSON.");
  }
  private email(value: unknown) {
    const email = typeof value === "string" ? value.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)
      throw this.validation("Listrak requires a valid email address.");
    return email;
  }
  private text(value: unknown, label: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum || /[\u0000\r\n]/.test(text))
      throw this.validation(`Listrak ${label} is invalid.`);
    return text;
  }
  private optionalText(value: unknown, label: string, maximum: number) {
    if (value == null || value === "") return null;
    return this.text(value, label, maximum);
  }
  private positiveInteger(value: unknown, label: string) {
    const normalized =
      typeof value === "number" ? String(value) : String(value ?? "").trim();
    if (!/^\d{1,12}$/.test(normalized) || Number(normalized) < 1)
      throw this.validation(`Listrak ${label} must be a positive integer.`);
    return normalized;
  }
  private operation(id: string) {
    const operation = LISTRAK_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new ListrakApiError(
        "tool_unavailable",
        "Listrak operation is not pinned.",
      );
    return operation;
  }
  private rejectSecrets(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value as JsonObject))
      if (
        /(client.?id|client.?secret|access.?token|authorization|password|cookie|url|endpoint|overrideUnsubscribe)/i.test(
          key,
        )
      )
        throw new ListrakApiError(
          "policy_blocked",
          "Credential, routing, or unsubscribe-override Listrak input fields are blocked.",
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
          /(client.?secret|access.?token|authorization|password|cookie)/i.test(
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
    return new ListrakApiError("provider_validation_error", message);
  }
}

export class ListrakApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
