import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  PLUTIO_OPERATION_BY_ID,
  type PlutioOperation,
} from "./plutio-operation-registry";

type JsonObject = Record<string, unknown>;
export type PlutioCredentials = {
  clientId: string;
  clientSecret: string;
  businessSubdomain: string;
};
export type PlutioOperationInput = { query?: JsonObject; json?: JsonObject };

export class PlutioApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PlutioApiAdapter {
  private static readonly ORIGIN = "https://api.plutio.com";
  private readonly tokens = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  health(credentials: PlutioCredentials) {
    return this.read(credentials, "business-get-workspace", {
      query: { limit: 1 },
    });
  }

  read(
    credentials: PlutioCredentials,
    operationId: string,
    input: PlutioOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.validation("Plutio read accepts GET operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: PlutioCredentials,
    operationId: string,
    input: PlutioOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.validation("Plutio manage accepts mutation operations only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: PlutioCredentials,
    operation: PlutioOperation,
    input: PlutioOperationInput,
  ) {
    this.rejectSecrets(input);
    const business = this.business(credentials.businessSubdomain);
    const token = await this.accessToken(credentials, business);
    const url = new URL(`/v1.11${operation.path}`, PlutioApiAdapter.ORIGIN);
    this.appendQuery(
      url.searchParams,
      input.query ?? {},
      operation.method === "GET",
    );
    if (
      url.origin !== PlutioApiAdapter.ORIGIN ||
      !url.pathname.startsWith("/v1.11/")
    )
      throw new PlutioApiError(
        "policy_blocked",
        "Plutio request escaped the fixed v1.11 API origin.",
        403,
      );
    let body: string | undefined;
    if (input.json !== undefined) {
      if (operation.method === "GET")
        throw this.validation(
          "Plutio GET operations do not accept a JSON body.",
        );
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Plutio request exceeds the 2 MB Relay limit.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          business,
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
      if (raw.byteLength > 5_000_000)
        throw this.validation("Plutio response exceeds the 5 MB Relay limit.");
      const data = this.redact(this.parse(raw));
      if (!response.ok)
        throw new PlutioApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Plutio returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof PlutioApiError) throw error;
      throw new PlutioApiError(
        "provider_unavailable",
        "Plutio could not be reached.",
        502,
      );
    }
  }

  private async accessToken(credentials: PlutioCredentials, business: string) {
    const clientId = this.credential(credentials.clientId, "client ID", false);
    const clientSecret = this.credential(
      credentials.clientSecret,
      "client secret",
      true,
    );
    const cacheKey = createHash("sha256")
      .update(`${clientId}\0${clientSecret}\0${business}`)
      .digest("hex");
    const cached = this.tokens.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });
    try {
      const response = await safeConnectorFetch("https://api.plutio.com/v1.11/oauth/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Plutio token response exceeds 1 MB.");
      const data = this.object(this.parse(raw));
      if (!response.ok)
        throw new PlutioApiError(
          response.status === 429
            ? "provider_rate_limited"
            : "token_refresh_failed",
          this.message(data) ?? "Plutio rejected the client credentials.",
          response.status,
        );
      const token = this.string(
        data?.accessToken ?? data?.access_token,
        20_000,
      );
      if (!token)
        throw new PlutioApiError(
          "token_refresh_failed",
          "Plutio did not return an access token.",
          502,
        );
      const expiresAt = this.expiry(
        data?.accessTokenExpiresAt ??
          data?.expires_at ??
          data?.expiresIn ??
          data?.expires_in,
      );
      this.tokens.set(cacheKey, { token, expiresAt });
      return token;
    } catch (error) {
      if (error instanceof PlutioApiError) throw error;
      throw new PlutioApiError(
        "provider_unavailable",
        "Plutio token service could not be reached.",
        502,
      );
    }
  }

  private appendQuery(
    params: URLSearchParams,
    query: JsonObject,
    defaultLimit: boolean,
  ) {
    if (Object.keys(query).length > 50)
      throw this.validation("Plutio query has too many fields.");
    for (const [key, raw] of Object.entries(query)) {
      if (!/^[A-Za-z0-9_.$-]{1,100}$/.test(key))
        throw this.validation(`Plutio query field ${key} is invalid.`);
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.validation(`Plutio query field ${key} has too many values.`);
      for (const value of values) {
        if (value == null || value === "") continue;
        if (typeof value === "object")
          throw this.validation(`Plutio query field ${key} must be scalar.`);
        const text = String(value);
        if (text.length > 20_000 || /[\r\n]/.test(text))
          throw this.validation(`Plutio query field ${key} is invalid.`);
        params.append(key, text);
      }
    }
    if (defaultLimit && !params.has("limit")) params.set("limit", "100");
    const limit = params.get("limit");
    if (
      limit &&
      (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 500)
    )
      throw this.validation(
        "Plutio limit must be an integer from 1 through 500.",
      );
    const skip = params.get("skip");
    if (skip && (!/^\d+$/.test(skip) || Number(skip) > 1_000_000))
      throw this.validation(
        "Plutio skip must be an integer from 0 through 1000000.",
      );
  }

  private operation(id: string) {
    const operation = PLUTIO_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.validation(
        "Plutio operation is not in the pinned v1.11 contract.",
      );
    return operation;
  }

  private credential(value: string, label: string, secret: boolean) {
    const text = value?.trim();
    const max = secret ? 20_000 : 1_000;
    if (!text || text.length > max || /[\r\n]/.test(text))
      throw new PlutioApiError(
        "credential_missing",
        `A valid Plutio ${label} is required.`,
        401,
      );
    return text;
  }

  private business(value: string) {
    const text = value?.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(text))
      throw this.validation("Plutio workspace subdomain is invalid.");
    return text;
  }

  private expiry(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const milliseconds =
        value > 10_000_000_000 ? value : Date.now() + value * 1_000;
      return Math.max(Date.now() + 60_000, milliseconds);
    }
    if (typeof value === "string") {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) return this.expiry(numeric);
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return Math.max(Date.now() + 60_000, parsed);
    }
    return Date.now() + 72 * 60 * 60 * 1_000;
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 12)
      throw new PlutioApiError(
        "policy_blocked",
        "Plutio request is too deeply nested.",
        403,
      );
    if (Array.isArray(value)) {
      if (value.length > 2_000)
        throw new PlutioApiError(
          "policy_blocked",
          "Plutio request array is too large.",
          403,
        );
      return value.forEach((item) => this.rejectSecrets(item, depth + 1));
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 2_000)
      throw new PlutioApiError(
        "policy_blocked",
        "Plutio request object is too large.",
        403,
      );
    for (const [key, item] of entries) {
      if (
        /(access.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new PlutioApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectSecrets(item, depth + 1);
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
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private string(value: unknown, max: number) {
    return typeof value === "string" && value.trim() && value.length <= max
      ? value.trim()
      : null;
  }

  private message(value: unknown) {
    const object = this.object(value);
    const candidate =
      object?.message ?? object?.error ?? object?.error_description;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new PlutioApiError("provider_validation_error", message);
  }
}
