import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export const OUTREACH_READ_OPERATIONS = [
  "accounts.list",
  "sequences.list",
] as const;

const ATTRIBUTE_FIELDS: Record<string, readonly string[]> = {
  accounts: [
    "name",
    "domain",
    "industry",
    "websiteUrl",
    "locality",
    "state",
    "country",
    "numberOfEmployees",
    "createdAt",
    "updatedAt",
  ],
  sequences: [
    "name",
    "description",
    "enabled",
    "locked",
    "sequenceType",
    "shareType",
    "numSteps",
    "createdAt",
    "updatedAt",
  ],
};

export class OutreachApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class OutreachApiAdapter {
  health(accessToken: string) {
    return this.request(accessToken, "accounts", 1);
  }

  read(accessToken: string, operation: string) {
    if (!OUTREACH_READ_OPERATIONS.includes(operation as never))
      throw new OutreachApiError(
        "policy_blocked",
        "Outreach operation is not in Relay's pinned read-only contract.",
        403,
      );
    return this.request(accessToken, operation.split(".")[0], 25);
  }

  private async request(accessToken: string, resource: string, limit: number) {
    this.requireToken(accessToken);
    const root = new URL("https://api.outreach.io/api/v2/");
    const url = new URL(resource, root);
    url.searchParams.set("page[size]", String(limit));
    url.searchParams.set("count", "false");
    if (
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      !ATTRIBUTE_FIELDS[resource]
    )
      throw new OutreachApiError(
        "policy_blocked",
        "Outreach requests must stay on Relay's two pinned API v2 collections.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.api+json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new OutreachApiError(
        "provider_unavailable",
        "Outreach could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Outreach response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new OutreachApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Outreach returned HTTP ${response.status}.`,
        response.status,
      );
    return this.summaries(resource, data);
  }

  private summaries(resource: string, value: unknown) {
    const body = this.object(value);
    const rows = Array.isArray(body.data) ? body.data.slice(0, 25) : [];
    return {
      data: rows.map((item) => {
        const record = this.object(item);
        const attributes = this.object(record.attributes);
        return {
          id: record.id,
          type: record.type,
          attributes: Object.fromEntries(
            ATTRIBUTE_FIELDS[resource]
              .filter((key) => attributes[key] !== undefined)
              .map((key) => [key, attributes[key]]),
          ),
        };
      }),
      hasNextPage: Boolean(this.object(body.links).next),
    };
  }

  private requireToken(accessToken: string) {
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new OutreachApiError(
        "credential_missing",
        "A valid Outreach OAuth access token is required.",
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
    const errors = this.object(value).errors;
    if (!Array.isArray(errors)) return null;
    const first = this.object(errors[0]);
    const candidate = first.detail ?? first.title;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new OutreachApiError("provider_validation_error", message, 400);
  }
}
