import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type VantaCredentials = { clientId: string; clientSecret: string };
export const VANTA_OPERATIONS = ["documents.list"] as const;

export class VantaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class VantaApiAdapter {
  private readonly origin = "https://api.vanta.com";

  async health(credentials: VantaCredentials) {
    const result = await this.read(credentials, {
      operation: "documents.list",
      pageSize: 1,
    });
    return {
      origin: this.origin,
      documentDirectoryVerified: true,
      visibleCountAtLeast: result.documents.length,
    };
  }

  async read(credentials: VantaCredentials, input: JsonObject) {
    if (input.operation !== "documents.list")
      throw new VantaApiError(
        "policy_blocked",
        "Vanta operation is outside Relay's pinned document directory.",
        403,
      );
    const pageSize = this.integer(input.pageSize, 1, 20, 20);
    const pageCursor = this.cursor(input.pageCursor);
    const token = await this.token(credentials);
    const url = new URL("/v1/documents", this.origin);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageCursor) url.searchParams.set("pageCursor", pageCursor);
    const response = await this.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const body = await this.body(response);
    if (!response.ok) throw this.httpError(response.status, "API");
    const results = this.object(body.results);
    if (!Array.isArray(results.data))
      throw new VantaApiError(
        "provider_validation_error",
        "Vanta returned an invalid document directory.",
        502,
      );
    const pageInfo = this.object(results.pageInfo);
    return {
      documents: results.data
        .slice(0, pageSize)
        .map((entry) => this.object(entry))
        .map((item) => ({
          id: this.id(item.id),
          title: this.text(item.title, 250),
          category: this.text(item.category, 120),
          overallStatus: this.text(item.overallStatus, 120),
        }))
        .filter((item) => item.id),
      pageSize,
      hasNextPage: pageInfo.hasNextPage === true,
      nextPageCursor:
        pageInfo.hasNextPage === true
          ? this.outputCursor(pageInfo.endCursor)
          : null,
    };
  }

  private async token(credentials: VantaCredentials) {
    const clientId = this.credential(credentials.clientId, "client ID");
    const clientSecret = this.credential(
      credentials.clientSecret,
      "client secret",
    );
    const response = await this.request(new URL("/oauth/token", this.origin), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "vanta-api.all:read",
      }),
    });
    const body = await this.body(response, 100_000);
    if (!response.ok) throw this.httpError(response.status, "token service");
    const accessToken = this.text(body.access_token, 20_000);
    if (!accessToken || /[\r\n]/.test(accessToken))
      throw new VantaApiError(
        "credential_missing",
        "Vanta did not return a valid access token.",
        401,
      );
    return accessToken;
  }

  private async request(url: URL, init: RequestInit) {
    try {
      return await safeConnectorFetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new VantaApiError(
        "provider_unavailable",
        "Vanta API could not be reached.",
        502,
      );
    }
  }

  private httpError(status: number, service: string) {
    return new VantaApiError(
      status === 429
        ? "provider_rate_limited"
        : status >= 500
          ? "provider_unavailable"
          : status === 401 || status === 403
            ? "credential_missing"
            : "provider_validation_error",
      `Vanta ${service} returned HTTP ${status}.`,
      status || 400,
    );
  }

  private credential(value: string, label: string) {
    if (!value || value.length > 2_000 || /[\r\n]/.test(value))
      throw new VantaApiError(
        "credential_missing",
        `A valid Vanta ${label} is required.`,
        401,
      );
    return value;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new VantaApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }

  private cursor(value: unknown) {
    if (value === undefined) return null;
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 500 ||
      !/^[A-Za-z0-9+/=_-]+$/.test(value)
    )
      throw new VantaApiError(
        "provider_validation_error",
        "Vanta page cursor is invalid.",
      );
    return value;
  }

  private outputCursor(value: unknown) {
    return typeof value === "string" &&
      value.length <= 500 &&
      /^[A-Za-z0-9+/=_-]+$/.test(value)
      ? value
      : null;
  }

  private async body(response: Response, max = 500_000) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > max)
      throw new VantaApiError(
        "provider_validation_error",
        "Vanta response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return {};
    }
  }

  private id(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9:_-]{1,200}$/.test(value)
      ? value
      : null;
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
