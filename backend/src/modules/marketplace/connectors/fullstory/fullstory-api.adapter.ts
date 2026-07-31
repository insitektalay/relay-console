import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type FullstoryCredentials = { apiKey: string };
export const FULLSTORY_READ_OPERATIONS = ["identity.get"] as const;

export class FullstoryApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class FullstoryApiAdapter {
  health(credentials: FullstoryCredentials) {
    return this.read(credentials, "identity.get");
  }

  read(credentials: FullstoryCredentials, operation: string) {
    if (!FULLSTORY_READ_OPERATIONS.includes(operation as never))
      throw new FullstoryApiError(
        "policy_blocked",
        "Fullstory operation is not in Relay's pinned identity contract.",
        403,
      );
    return this.identity(credentials);
  }

  private async identity(credentials: FullstoryCredentials) {
    this.requireCredentials(credentials);
    const url = new URL("https://api.fullstory.com/me");
    if (
      url.origin !== "https://api.fullstory.com" ||
      url.pathname !== "/me" ||
      [...url.searchParams].length
    )
      throw new FullstoryApiError(
        "policy_blocked",
        "Fullstory requests must stay on the parameter-free identity route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${credentials.apiKey}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new FullstoryApiError(
        "provider_unavailable",
        "Fullstory could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 100_000)
      throw this.invalid("Fullstory response exceeds Relay's 100 KB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new FullstoryApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Fullstory returned HTTP ${response.status}.`,
        response.status,
      );
    const body = this.object(data);
    return {
      organizationId: this.string(body.orgId, 200),
      permissionLevel: this.permission(body.role),
    };
  }

  private requireCredentials(credentials: FullstoryCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new FullstoryApiError(
        "credential_missing",
        "A valid Fullstory API key is required.",
        401,
      );
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "credential_missing";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    const body = this.object(value);
    const candidate = body.message ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private permission(value: unknown) {
    const mapping: Record<string, string> = {
      USER: "standard",
      ARCHITECT: "architect",
      ADMIN: "admin",
    };
    return typeof value === "string" ? (mapping[value] ?? "other") : null;
  }

  private string(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new FullstoryApiError("provider_validation_error", message, 400);
  }
}
