import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type AbTastyCredentials = { accessToken: string; accountId: string };
export const AB_TASTY_READ_OPERATIONS = ["projects.list"] as const;

export class AbTastyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class AbTastyApiAdapter {
  health(credentials: AbTastyCredentials) {
    return this.read(credentials, "projects.list");
  }

  read(credentials: AbTastyCredentials, operation: string) {
    if (!AB_TASTY_READ_OPERATIONS.includes(operation as never))
      throw new AbTastyApiError(
        "policy_blocked",
        "AB Tasty operation is not in Relay's pinned project-list contract.",
        403,
      );
    return this.projects(credentials);
  }

  private async projects(credentials: AbTastyCredentials) {
    this.requireCredentials(credentials);
    const url = new URL(
      `https://api.flagship.io/v1/accounts/${encodeURIComponent(credentials.accountId)}/projects`,
    );
    url.searchParams.set("_page", "0");
    url.searchParams.set("_max_per_page", "100");
    if (
      url.origin !== "https://api.flagship.io" ||
      url.pathname !== `/v1/accounts/${credentials.accountId}/projects` ||
      url.searchParams.toString() !== "_page=0&_max_per_page=100"
    )
      throw new AbTastyApiError(
        "policy_blocked",
        "AB Tasty requests must stay on the bounded account project-list route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AbTastyApiError(
        "provider_unavailable",
        "AB Tasty could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw this.invalid("AB Tasty response exceeds Relay's 1 MB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new AbTastyApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `AB Tasty returned HTTP ${response.status}.`,
        response.status,
      );
    const body = this.object(data);
    const rows = Array.isArray(body.items) ? body.items : [];
    return {
      projects: rows.slice(0, 100).map((item) => {
        const project = this.object(item);
        return {
          id: this.string(project.id, 200),
          name: this.string(project.name, 500),
        };
      }),
      truncated:
        rows.length > 100 ||
        (typeof body.total_count === "number" &&
          body.total_count > rows.length),
    };
  }

  private requireCredentials(credentials: AbTastyCredentials) {
    if (
      !credentials.accessToken ||
      credentials.accessToken.length > 16_000 ||
      /[\r\n]/.test(credentials.accessToken)
    )
      throw new AbTastyApiError(
        "credential_missing",
        "A valid AB Tasty Remote Control API token is required.",
        401,
      );
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(credentials.accountId))
      throw new AbTastyApiError(
        "credential_missing",
        "A valid AB Tasty account ID is required.",
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
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
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
    return new AbTastyApiError("provider_validation_error", message, 400);
  }
}
