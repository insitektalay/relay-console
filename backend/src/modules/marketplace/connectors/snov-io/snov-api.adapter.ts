import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type SnovCredentials = { clientId: string; clientSecret: string };

export class SnovApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SnovApiAdapter {
  private readonly origin = "https://api.snov.io";
  private readonly maxResponseBytes = 256 * 1024;
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: SnovCredentials) {
    await this.accessToken(credentials);
    return { apiOrigin: this.origin, clientCredentialsValidated: true };
  }

  async startEmailVerification(
    credentials: SnovCredentials,
    rawEmail: unknown,
  ) {
    const email = this.email(rawEmail);
    const accessToken = await this.accessToken(credentials);
    const body = new URLSearchParams();
    body.append("emails[]", email);
    const response = this.object(
      await this.request(
        "/v2/email-verification/start",
        "POST",
        accessToken,
        undefined,
        body,
      ),
    );
    const taskHash = this.taskHash(this.object(response.data).task_hash);
    return { taskHash, submitted: true, maxEmails: 1 };
  }

  async getEmailVerificationResult(
    credentials: SnovCredentials,
    rawTaskHash: unknown,
  ) {
    const taskHash = this.taskHash(rawTaskHash);
    const accessToken = await this.accessToken(credentials);
    const response = this.object(
      await this.request("/v2/email-verification/result", "GET", accessToken, {
        task_hash: taskHash,
      }),
    );
    const taskStatus = this.requiredEnum(
      response.status,
      ["completed", "in_progress"],
      "Snov.io returned an invalid task status",
    );
    if (taskStatus === "in_progress") return { taskHash, completed: false };
    if (!Array.isArray(response.data) || response.data.length !== 1)
      throw this.invalid("Snov.io returned an invalid single-email result");
    const item = this.object(response.data[0]);
    const result = this.object(item.result);
    const status = this.requiredEnum(
      result.smtp_status,
      ["valid", "not_valid", "unknown"],
      "Snov.io returned an invalid verification status",
    );
    const reason =
      status === "unknown"
        ? this.optionalReason(result.unknown_status_reason)
        : null;
    return {
      taskHash,
      completed: true,
      status,
      reason,
      doNotProcess: reason === "hidden_by_owner",
      checks: {
        validFormat: this.boolean(result.is_valid_format),
        disposable: this.boolean(result.is_disposable),
        webmail: this.boolean(result.is_webmail),
        gibberish: this.boolean(result.is_gibberish),
      },
    };
  }

  private async accessToken(credentials: SnovCredentials) {
    const clientId = this.credential(credentials?.clientId, "API User ID");
    const clientSecret = this.credential(
      credentials?.clientSecret,
      "API Secret",
    );
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });
    const response = this.object(
      await this.request(
        "/v1/oauth/access_token",
        "POST",
        null,
        undefined,
        body,
      ),
    );
    const accessToken = this.credential(response.access_token, "access token");
    if (response.token_type !== "Bearer" || response.expires_in !== 3600)
      throw this.invalid("Snov.io returned an invalid access-token contract");
    return accessToken;
  }

  private async request(
    path:
      | "/v1/oauth/access_token"
      | "/v2/email-verification/start"
      | "/v2/email-verification/result",
    method: "GET" | "POST",
    accessToken: string | null,
    parameters?: Record<string, string>,
    body?: URLSearchParams,
  ) {
    const endpoint = new URL(path, this.origin);
    for (const [key, value] of Object.entries(parameters ?? {}))
      endpoint.searchParams.set(key, value);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "RelayConsole-Snov/1.0",
    };
    if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    let response: Response;
    try {
      response = await this.requester(endpoint, {
        method,
        headers,
        body: body?.toString(),
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
    } catch {
      throw new SnovApiError(
        "provider_unavailable",
        "Snov.io could not be reached",
        502,
      );
    }
    const responseBody = await this.safeBody(response);
    if (!response.ok)
      throw new SnovApiError(
        this.errorCode(response.status),
        `Snov.io returned HTTP ${response.status}`,
        response.status,
      );
    return responseBody;
  }

  private credential(value: unknown, label: string) {
    const credential = typeof value === "string" ? value.trim() : "";
    if (
      credential.length < 12 ||
      credential.length > 512 ||
      /[\u0000-\u0020\u007f]/.test(credential)
    )
      throw new SnovApiError(
        "credential_missing",
        `A valid customer-owned Snov.io ${label} is required`,
        401,
      );
    return credential;
  }

  private email(value: unknown) {
    if (typeof value !== "string")
      throw this.invalid("email must be a valid address");
    const email = value.trim().toLowerCase();
    if (
      email.length < 3 ||
      email.length > 254 ||
      !/^[^\s@<>]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(
        email,
      ) ||
      !email.split("@")[1]?.includes(".")
    )
      throw this.invalid("email must be a valid address");
    return email;
  }

  private taskHash(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value))
      throw this.invalid("taskHash must be a valid Snov.io task identifier");
    return value;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private boolean(value: unknown) {
    if (typeof value !== "boolean")
      throw this.invalid("Snov.io returned invalid verification data");
    return value;
  }

  private optionalReason(value: unknown) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string")
      throw this.invalid("Snov.io returned an invalid unknown-status reason");
    const normalized = value.trim().toLowerCase().replaceAll(" ", "_");
    if (normalized === "greylisted") return "greylist";
    if (
      ![
        "banned",
        "catchall",
        "connection_error",
        "greylist",
        "hidden_by_owner",
      ].includes(normalized)
    )
      throw this.invalid("Snov.io returned an invalid unknown-status reason");
    return normalized;
  }

  private requiredEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
    message: string,
  ): T {
    if (typeof value !== "string" || !allowed.includes(value as T))
      throw this.invalid(message);
    return value as T;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Snov.io response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new SnovApiError(
        "provider_unavailable",
        "Snov.io response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Snov.io response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("Snov.io returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Snov.io returned invalid JSON");
      return {};
    }
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new SnovApiError("provider_validation_error", message, 400);
  }
}
