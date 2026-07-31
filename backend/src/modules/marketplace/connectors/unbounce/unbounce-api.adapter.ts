import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type UnbounceCredentials = { apiKey: string };
export const UNBOUNCE_READ_OPERATIONS = ["pages.list"] as const;

export class UnbounceApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class UnbounceApiAdapter {
  health(credentials: UnbounceCredentials) {
    return this.read(credentials, "pages.list");
  }

  read(credentials: UnbounceCredentials, operation: string) {
    if (!UNBOUNCE_READ_OPERATIONS.includes(operation as never))
      throw new UnbounceApiError(
        "policy_blocked",
        "Unbounce operation is not in Relay's pinned page-list contract.",
        403,
      );
    return this.pages(credentials);
  }

  private async pages(credentials: UnbounceCredentials) {
    this.requireCredentials(credentials);
    const url = new URL("https://api.unbounce.com/pages");
    url.searchParams.set("limit", "100");
    if (
      url.origin !== "https://api.unbounce.com" ||
      url.pathname !== "/pages" ||
      url.searchParams.toString() !== "limit=100"
    )
      throw new UnbounceApiError(
        "policy_blocked",
        "Unbounce requests must stay on the bounded page-list route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.unbounce.api.v0.4+json",
          Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:`).toString("base64")}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new UnbounceApiError(
        "provider_unavailable",
        "Unbounce could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw this.invalid("Unbounce response exceeds Relay's 1 MB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new UnbounceApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Unbounce returned HTTP ${response.status}.`,
        response.status,
      );
    return this.pageSummaries(data);
  }

  private pageSummaries(value: unknown) {
    const body = this.object(value);
    const rows = Array.isArray(body.pages) ? body.pages : [];
    return {
      pages: rows.slice(0, 100).map((item) => {
        const page = this.object(item);
        return {
          id: this.string(page.id, 200),
          name: this.string(page.name, 500),
          state: this.string(page.state, 100),
          domain: this.string(page.domain, 253),
        };
      }),
      truncated: rows.length > 100,
    };
  }

  private requireCredentials(credentials: UnbounceCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new UnbounceApiError(
        "credential_missing",
        "A valid Unbounce API key is required.",
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
    return new UnbounceApiError("provider_validation_error", message, 400);
  }
}
