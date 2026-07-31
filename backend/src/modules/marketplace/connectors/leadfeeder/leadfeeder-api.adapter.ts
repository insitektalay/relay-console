import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type LeadfeederCredentials = { apiKey: string };
export const LEADFEEDER_READ_OPERATIONS = ["accounts.list"] as const;

export class LeadfeederApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class LeadfeederApiAdapter {
  health(credentials: LeadfeederCredentials) {
    return this.read(credentials, "accounts.list");
  }

  read(credentials: LeadfeederCredentials, operation: string) {
    if (!LEADFEEDER_READ_OPERATIONS.includes(operation as never))
      throw new LeadfeederApiError(
        "policy_blocked",
        "Leadfeeder operation is not in Relay's pinned account-list contract.",
        403,
      );
    return this.accounts(credentials);
  }

  private async accounts(credentials: LeadfeederCredentials) {
    this.requireCredentials(credentials);
    const url = new URL("https://api.leadfeeder.com/v1/accounts");
    if (
      url.origin !== "https://api.leadfeeder.com" ||
      url.pathname !== "/v1/accounts" ||
      [...url.searchParams].length
    )
      throw new LeadfeederApiError(
        "policy_blocked",
        "Leadfeeder requests must stay on the unfiltered account-list route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": credentials.apiKey,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new LeadfeederApiError(
        "provider_unavailable",
        "Leadfeeder could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw this.invalid("Leadfeeder response exceeds Relay's 1 MB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new LeadfeederApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Leadfeeder returned HTTP ${response.status}.`,
        response.status,
      );
    return this.accountNames(data);
  }

  private accountNames(value: unknown) {
    const body = this.object(value);
    const rows = Array.isArray(body.data) ? body.data : [];
    return {
      accounts: rows.slice(0, 100).map((item) => {
        const resource = this.object(item);
        const attributes = this.object(resource.attributes);
        return {
          id: this.string(resource.id, 200),
          type: resource.type === "account" ? "account" : undefined,
          name: this.string(attributes.name, 500),
        };
      }),
      truncated: rows.length > 100,
    };
  }

  private requireCredentials(credentials: LeadfeederCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new LeadfeederApiError(
        "credential_missing",
        "A valid Leadfeeder API key is required.",
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

  private string(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new LeadfeederApiError("provider_validation_error", message, 400);
  }
}
