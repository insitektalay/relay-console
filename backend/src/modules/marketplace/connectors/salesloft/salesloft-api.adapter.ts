import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export const SALESLOFT_READ_OPERATIONS = [
  "accounts.list",
  "cadences.list",
] as const;

const RESULT_FIELDS: Record<string, readonly string[]> = {
  accounts: [
    "id",
    "name",
    "domain",
    "website",
    "industry",
    "size",
    "created_at",
    "updated_at",
  ],
  cadences: [
    "id",
    "name",
    "team_cadence",
    "shared",
    "archived",
    "cadence_function",
    "current_state",
    "latest_active_date",
    "created_at",
    "updated_at",
  ],
};

export class SalesloftApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SalesloftApiAdapter {
  health(accessToken: string) {
    return this.request(accessToken, "accounts", 1);
  }

  read(accessToken: string, operation: string) {
    if (!SALESLOFT_READ_OPERATIONS.includes(operation as never))
      throw new SalesloftApiError(
        "policy_blocked",
        "Salesloft operation is not in Relay's pinned read-only contract.",
        403,
      );
    return this.request(accessToken, operation.split(".")[0], 25);
  }

  private async request(accessToken: string, resource: string, limit: number) {
    this.requireToken(accessToken);
    const root = new URL("https://api.salesloft.com/v2/");
    const url = new URL(resource, root);
    url.searchParams.set("per_page", String(limit));
    url.searchParams.set("page", "1");
    url.searchParams.set("include_paging_counts", "false");
    if (
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      !RESULT_FIELDS[resource]
    )
      throw new SalesloftApiError(
        "policy_blocked",
        "Salesloft requests must stay on Relay's two pinned API v2 collections.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new SalesloftApiError(
        "provider_unavailable",
        "Salesloft could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Salesloft response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new SalesloftApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Salesloft returned HTTP ${response.status}.`,
        response.status,
      );
    return this.summaries(resource, data);
  }

  private summaries(resource: string, value: unknown) {
    const body = this.object(value);
    const rows = Array.isArray(body.data) ? body.data.slice(0, 25) : [];
    const metadata = this.object(body.metadata);
    return {
      data: rows.map((item) => {
        const record = this.object(item);
        return Object.fromEntries(
          RESULT_FIELDS[resource]
            .filter((key) => record[key] !== undefined)
            .map((key) => [key, record[key]]),
        );
      }),
      hasNextPage:
        metadata.next_page !== null && metadata.next_page !== undefined,
    };
  }

  private requireToken(accessToken: string) {
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new SalesloftApiError(
        "credential_missing",
        "A valid Salesloft OAuth access token is required.",
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

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 25).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 500_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie|email|phone|address|personal|mailing|content|body|template)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
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
    if (typeof body.error === "string") return body.error.slice(0, 500);
    const errors = this.object(body.errors);
    const first = Object.values(errors)[0];
    if (Array.isArray(first) && typeof first[0] === "string")
      return first[0].slice(0, 500);
    return null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new SalesloftApiError("provider_validation_error", message, 400);
  }
}
