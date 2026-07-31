import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  DOTDIGITAL_OPERATION_BY_ID,
  type DotdigitalOperation,
} from "./dotdigital-operation-registry";

type JsonObject = Record<string, unknown>;
export type DotdigitalCredentials = { username: string; password: string };
export type DotdigitalInput = {
  addressBookId?: unknown;
  email?: unknown;
  select?: unknown;
  skip?: unknown;
  emailStatus?: unknown;
  consentAttestation?: boolean;
  doubleOptInAttestation?: boolean;
};

@Injectable()
export class DotdigitalApiAdapter {
  private static readonly DISCOVERY_URL =
    "https://r1-api.dotdigital.com/v2/account-info";
  private static readonly ALLOWED_ORIGINS = new Set([
    "https://r1-api.dotdigital.com",
    "https://r2-api.dotdigital.com",
    "https://r3-api.dotdigital.com",
  ]);
  private readonly origins = new Map<
    string,
    { origin: string; expiresAt: number }
  >();

  async health(credentials: DotdigitalCredentials) {
    const origin = await this.apiOrigin(credentials);
    return { authenticated: true, apiOrigin: origin };
  }

  read(
    credentials: DotdigitalCredentials,
    operationId: string,
    input: DotdigitalInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation("Dotdigital read accepts read operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: DotdigitalCredentials,
    operationId: string,
    input: DotdigitalInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation(
        "Dotdigital manage accepts one-contact updates only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: DotdigitalCredentials,
    operation: DotdigitalOperation,
    input: DotdigitalInput,
  ) {
    this.rejectSecrets(input);
    const authorization = this.authorization(credentials);
    let path = operation.path;
    if (path.includes("{addressBookId}"))
      path = path.replace(
        "{addressBookId}",
        this.positiveInteger(input.addressBookId, "addressBookId"),
      );
    if (path.includes("{email}"))
      path = path.replace(
        "{email}",
        encodeURIComponent(this.email(input.email)),
      );
    let body: string | undefined;
    if (operation.policy === "manage") {
      if (input.consentAttestation !== true)
        throw new DotdigitalApiError(
          "policy_blocked",
          "Dotdigital contact updates require explicit recorded contact authorization.",
        );
      const status = this.text(input.emailStatus, "emailStatus", 20);
      if (!new Set(["subscribed", "unsubscribed"]).has(status))
        throw this.validation("Dotdigital emailStatus is invalid.");
      if (status === "subscribed" && input.doubleOptInAttestation !== true)
        throw new DotdigitalApiError(
          "policy_blocked",
          "Dotdigital subscription requires recorded double-opt-in evidence.",
        );
      body = JSON.stringify({
        identifiers: { email: this.email(input.email) },
        channelProperties: {
          email: {
            status,
            optInType: status === "subscribed" ? "double" : "unknown",
          },
        },
      });
    }

    const origin = await this.apiOrigin(credentials, authorization);
    const url = new URL(path, origin);
    if (operation.id === "list_address_books") {
      const select = this.boundedInteger(input.select ?? 20, "select", 1, 50);
      const skip = this.boundedInteger(input.skip ?? 0, "skip", 0, 5_000);
      url.searchParams.set("select", String(select));
      url.searchParams.set("skip", String(skip));
    } else if (input.select !== undefined || input.skip !== undefined) {
      throw this.validation(
        "Dotdigital pagination is accepted only for address-book inventory.",
      );
    }

    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: authorization,
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
        throw this.validation("Dotdigital response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new DotdigitalApiError(
          this.safeCode(response.status),
          `Dotdigital returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof DotdigitalApiError) throw error;
      throw new DotdigitalApiError(
        "provider_unavailable",
        "Dotdigital could not be reached.",
      );
    }
  }

  private async apiOrigin(
    credentials: DotdigitalCredentials,
    authorization = this.authorization(credentials),
  ) {
    const key = createHash("sha256").update(authorization).digest("hex");
    const cached = this.origins.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.origin;
    let response: Response;
    try {
      response = await safeConnectorFetch(DotdigitalApiAdapter.DISCOVERY_URL, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: authorization },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DotdigitalApiError(
        "provider_unavailable",
        "Dotdigital regional endpoint discovery failed.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 128_000)
      throw this.validation("Dotdigital account-info response is too large.");
    const parsed = this.parseJson(raw);
    if (Array.isArray(parsed))
      throw this.validation("Dotdigital account-info response is invalid.");
    const data = parsed;
    if (!response.ok)
      throw new DotdigitalApiError(
        this.safeCode(response.status),
        `Dotdigital account-info returned HTTP ${response.status}.`,
        response.status,
      );
    const endpoint =
      typeof data.ApiEndpoint === "string"
        ? data.ApiEndpoint
        : typeof data.apiEndpoint === "string"
          ? data.apiEndpoint
          : "";
    let origin: string;
    try {
      const parsed = new URL(endpoint);
      origin = parsed.origin;
      if (
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      )
        throw new Error("not an origin");
    } catch {
      throw this.validation(
        "Dotdigital returned an invalid regional API endpoint.",
      );
    }
    if (!DotdigitalApiAdapter.ALLOWED_ORIGINS.has(origin))
      throw new DotdigitalApiError(
        "policy_blocked",
        "Dotdigital returned a regional API endpoint outside the allowlist.",
      );
    this.origins.set(key, { origin, expiresAt: Date.now() + 30 * 60_000 });
    return origin;
  }

  private authorization(credentials: DotdigitalCredentials) {
    const username = credentials.username.trim();
    const password = credentials.password.trim();
    if (
      !username ||
      !password ||
      username.length > 500 ||
      password.length > 20_000 ||
      /[\u0000\r\n]/.test(username)
    )
      throw new DotdigitalApiError(
        "credential_missing",
        "Dotdigital API username and password are missing.",
      );
    return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
  }

  private parseJson(raw: Buffer): JsonObject | unknown[] {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("Dotdigital returned invalid JSON.");
  }
  private email(value: unknown) {
    const email = typeof value === "string" ? value.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)
      throw this.validation("Dotdigital requires a valid email address.");
    return email;
  }
  private text(value: unknown, label: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum || /[\u0000\r\n]/.test(text))
      throw this.validation(`Dotdigital ${label} is invalid.`);
    return text;
  }
  private positiveInteger(value: unknown, label: string) {
    return String(this.boundedInteger(value, label, 1, 2_147_483_647));
  }
  private boundedInteger(
    value: unknown,
    label: string,
    minimum: number,
    maximum: number,
  ) {
    const number = typeof value === "number" ? value : Number(String(value));
    if (!Number.isInteger(number) || number < minimum || number > maximum)
      throw this.validation(
        `Dotdigital ${label} must be between ${minimum} and ${maximum}.`,
      );
    return number;
  }
  private operation(id: string) {
    const operation = DOTDIGITAL_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new DotdigitalApiError(
        "tool_unavailable",
        "Dotdigital operation is not pinned.",
      );
    return operation;
  }
  private rejectSecrets(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value as JsonObject))
      if (
        /(username|password|api.?key|authorization|cookie|url|uri|endpoint|resubscribe)/i.test(
          key,
        )
      )
        throw new DotdigitalApiError(
          "policy_blocked",
          "Credential, routing, or resubscribe-override Dotdigital input fields are blocked.",
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
          /(password|api.?key|authorization|cookie)/i.test(key)
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
    return new DotdigitalApiError("provider_validation_error", message);
  }
}

export class DotdigitalApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
