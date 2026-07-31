import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type TeamleaderCredentials = { accessToken: string };

const API_ORIGIN = "https://api.focus.teamleader.eu";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TeamleaderApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class TeamleaderApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: TeamleaderCredentials) {
    const user = this.user(
      this.object((await this.send(credentials, "/users.me", {})).data),
    );
    if (!user.userId) {
      throw new TeamleaderApiError(
        "provider_validation_error",
        "Teamleader did not return the OAuth-bound user.",
      );
    }
    return { userId: user.userId, apiOrigin: API_ORIGIN, reachable: true };
  }

  async getCurrentUser(credentials: TeamleaderCredentials) {
    return {
      user: this.user(
        this.object((await this.send(credentials, "/users.me", {})).data),
      ),
    };
  }

  async listDeals(credentials: TeamleaderCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, "/deals.list", {
      page: { size: limit, number: 1 },
    });
    const rows = Array.isArray(body.data) ? body.data : [];
    const meta = this.object(body.meta);
    const page = this.object(meta.page);
    return {
      deals: rows.slice(0, limit).map((value) => this.deal(this.object(value))),
      hasMore:
        typeof meta.matches === "number" &&
        typeof page.size === "number" &&
        meta.matches > page.size,
    };
  }

  async getDeal(credentials: TeamleaderCredentials, input: JsonObject) {
    const dealId = this.uuid(input.dealId, "Deal");
    const deal = this.deal(
      this.object(
        (await this.send(credentials, "/deals.info", { id: dealId })).data,
      ),
    );
    if (deal.dealId !== dealId) {
      throw new TeamleaderApiError(
        "provider_validation_error",
        "Teamleader returned a deal outside the requested binding.",
      );
    }
    return { deal };
  }

  private async send(
    credentials: TeamleaderCredentials,
    path: "/users.me" | "/deals.list" | "/deals.info",
    body: JsonObject,
  ) {
    if (
      !credentials.accessToken.trim() ||
      credentials.accessToken.length > 8192
    ) {
      throw new TeamleaderApiError(
        "credential_missing",
        "Teamleader OAuth access token is missing or invalid.",
      );
    }
    const url = new URL(path, API_ORIGIN);
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new TeamleaderApiError(
        "provider_unavailable",
        "Teamleader is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new TeamleaderApiError(
        "provider_validation_error",
        "Teamleader response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new TeamleaderApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Teamleader API request failed.",
        response.status,
      );
    }
    try {
      const parsed = raw ? (JSON.parse(raw) as unknown) : {};
      return this.object(parsed);
    } catch {
      throw new TeamleaderApiError(
        "provider_validation_error",
        "Teamleader returned an invalid response.",
      );
    }
  }

  private user(row: JsonObject) {
    return {
      userId: this.uuidOrNull(row.id),
      firstName: this.scalar(row.first_name),
      lastName: this.scalar(row.last_name),
      language: this.scalar(row.language),
    };
  }

  private deal(row: JsonObject) {
    const estimatedValue = this.object(row.estimated_value);
    return {
      dealId: this.uuidOrNull(row.id),
      title: this.scalar(row.title),
      status: this.scalar(row.status),
      reference: this.scalar(row.reference),
      estimatedValueAmount: this.scalar(estimatedValue.amount),
      estimatedValueCurrency: this.scalar(estimatedValue.currency),
      estimatedClosingDate: this.scalar(row.estimated_closing_date),
      createdAt: this.scalar(row.created_at),
      updatedAt: this.scalar(row.updated_at),
      closedAt: this.scalar(row.closed_at),
    };
  }

  private uuid(value: unknown, label: string) {
    if (typeof value !== "string" || !UUID.test(value)) {
      throw new TeamleaderApiError(
        "provider_validation_error",
        `A valid Teamleader ${label} UUID is required.`,
      );
    }
    return value.toLowerCase();
  }

  private uuidOrNull(value: unknown) {
    return typeof value === "string" && UUID.test(value)
      ? value.toLowerCase()
      : null;
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new TeamleaderApiError(
        "provider_validation_error",
        "Teamleader result limit is outside the supported range.",
      );
    }
    return Number(value);
  }
}
