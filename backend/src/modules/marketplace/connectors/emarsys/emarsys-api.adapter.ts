import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  EMARSYS_OPERATION_BY_ID,
  type EmarsysOperation,
} from "./emarsys-operation-registry";

type JsonObject = Record<string, unknown>;
export type EmarsysCredentials = { clientId: string; clientSecret: string };
export type EmarsysInput = {
  emailId?: unknown;
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  optIn?: unknown;
  consentAttestation?: boolean;
  doubleOptInAttestation?: boolean;
};

@Injectable()
export class EmarsysApiAdapter {
  private static readonly API_ORIGIN = "https://api.emarsys.net";
  private static readonly TOKEN_URL = "https://auth.emarsys.net/oauth2/token";
  private readonly tokens = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  health(credentials: EmarsysCredentials) {
    return this.read(credentials, "list_available_fields", {});
  }

  read(
    credentials: EmarsysCredentials,
    operationId: string,
    input: EmarsysInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation("Emarsys read accepts read operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: EmarsysCredentials,
    operationId: string,
    input: EmarsysInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation("Emarsys manage accepts contact writes only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: EmarsysCredentials,
    operation: EmarsysOperation,
    input: EmarsysInput,
  ) {
    this.rejectSecrets(input);
    let path = operation.path;
    const query = new URLSearchParams();
    let body: string | undefined;

    if (operation.id === "get_email_campaign") {
      const emailId = this.positiveInteger(input.emailId, "email campaign ID");
      path = path.replace("{emailId}", emailId);
      query.set("raw", "false");
    } else if (operation.id === "get_contact_by_email") {
      const email = this.email(input.email);
      query.set("return", "3");
      query.set("3", email);
      query.set("excludeempty", "true");
    } else if (operation.policy === "manage") {
      if (input.consentAttestation !== true)
        throw new EmarsysApiError(
          "policy_blocked",
          "Emarsys contact writes require explicit recorded contact authorization.",
        );
      const optIn = this.boolean(input.optIn, "optIn");
      if (optIn && input.doubleOptInAttestation !== true)
        throw new EmarsysApiError(
          "policy_blocked",
          "Emarsys opt-in=true requires recorded double-opt-in evidence.",
        );
      const contact: JsonObject = {
        "3": this.email(input.email),
        "31": optIn ? 1 : 2,
      };
      const firstName = this.optionalText(input.firstName, "firstName");
      const lastName = this.optionalText(input.lastName, "lastName");
      if (firstName) contact["1"] = firstName;
      if (lastName) contact["2"] = lastName;
      body = JSON.stringify({ key_id: "3", contacts: [contact] });
      if (operation.id === "update_contact")
        query.set("create_if_not_exists", "false");
    }

    const url = new URL(path, EmarsysApiAdapter.API_ORIGIN);
    url.search = query.toString();
    const token = await this.accessToken(credentials);
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
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
        throw this.validation("Emarsys response exceeds 1 MB.");
      const parsed = this.parseJson(raw);
      if (!response.ok || this.providerRejected(parsed))
        throw new EmarsysApiError(
          this.safeCode(response.status),
          response.ok
            ? "Emarsys rejected the operation."
            : `Emarsys returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(parsed),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof EmarsysApiError) throw error;
      throw new EmarsysApiError(
        "provider_unavailable",
        "Emarsys could not be reached.",
      );
    }
  }

  private async accessToken(credentials: EmarsysCredentials) {
    const clientId = credentials.clientId.trim();
    const clientSecret = credentials.clientSecret.trim();
    if (
      !clientId ||
      !clientSecret ||
      clientId.length > 500 ||
      clientSecret.length > 20_000
    )
      throw new EmarsysApiError(
        "credential_missing",
        "Emarsys client credentials are missing.",
      );
    const key = createHash("sha256")
      .update(`${clientId}\0${clientSecret}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const authorization = Buffer.from(
      `${clientId}:${clientSecret}`,
      "utf8",
    ).toString("base64");
    let response: Response;
    try {
      response = await safeConnectorFetch(EmarsysApiAdapter.TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new EmarsysApiError(
        "token_refresh_failed",
        "Emarsys token exchange failed.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 64_000)
      throw new EmarsysApiError(
        "token_refresh_failed",
        "Emarsys token response is invalid.",
      );
    const data = this.parseJson(raw);
    const token =
      typeof data.access_token === "string" ? data.access_token : "";
    const expiresIn = Number(data.expires_in);
    if (!response.ok || !token || !Number.isFinite(expiresIn) || expiresIn < 1)
      throw new EmarsysApiError(
        "token_refresh_failed",
        "Emarsys did not return a usable access token.",
        response.status,
      );
    this.tokens.set(key, {
      token,
      expiresAt: Date.now() + Math.min(expiresIn, 32_400) * 1_000,
    });
    return token;
  }

  private providerRejected(data: JsonObject) {
    return typeof data.replyCode === "number" && data.replyCode !== 0;
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
    throw this.validation("Emarsys returned invalid JSON.");
  }

  private email(value: unknown) {
    const email = typeof value === "string" ? value.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)
      throw this.validation("Emarsys requires a valid email address.");
    return email;
  }

  private optionalText(value: unknown, label: string) {
    if (value == null || value === "") return null;
    if (
      typeof value !== "string" ||
      value.length > 200 ||
      /[\u0000\r\n]/.test(value)
    )
      throw this.validation(`Emarsys ${label} is invalid.`);
    return value;
  }

  private boolean(value: unknown, label: string) {
    if (typeof value !== "boolean")
      throw this.validation(`Emarsys ${label} must be boolean.`);
    return value;
  }

  private positiveInteger(value: unknown, label: string) {
    const normalized =
      typeof value === "number" ? String(value) : String(value ?? "").trim();
    if (!/^\d{1,12}$/.test(normalized) || Number(normalized) < 1)
      throw this.validation(`Emarsys ${label} must be a positive integer.`);
    return normalized;
  }

  private operation(id: string) {
    const operation = EMARSYS_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new EmarsysApiError(
        "tool_unavailable",
        "Emarsys operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value as JsonObject)) {
      if (
        /(client.?id|client.?secret|access.?token|authorization|password|cookie|url|endpoint)/i.test(
          key,
        )
      )
        throw new EmarsysApiError(
          "policy_blocked",
          "Credential-bearing or routing Emarsys input fields are blocked.",
        );
    }
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
    return new EmarsysApiError("provider_validation_error", message);
  }
}

export class EmarsysApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
