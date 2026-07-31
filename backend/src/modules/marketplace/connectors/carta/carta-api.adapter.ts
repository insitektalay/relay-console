import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type CartaCredentials = { clientId: string; clientSecret: string };
export const CARTA_SCOPE = "read_investor_firms";
export const CARTA_OPERATIONS = ["investor.firms.list"] as const;

export class CartaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class CartaApiAdapter {
  private readonly apiOrigin = "https://api.carta.com";
  private readonly loginOrigin = "https://login.app.carta.com";

  async health(credentials: CartaCredentials) {
    const result = await this.read(credentials, {
      operation: "investor.firms.list",
      pageSize: 1,
    });
    return {
      apiOrigin: this.apiOrigin,
      scope: CARTA_SCOPE,
      firmDirectoryVerified: true,
      visibleCountAtLeast: result.firms.length,
    };
  }

  async read(credentials: CartaCredentials, input: JsonObject) {
    if (input.operation !== "investor.firms.list")
      throw new CartaApiError(
        "policy_blocked",
        "Carta operation is outside Relay's pinned firm directory.",
        403,
      );
    const pageSize = this.integer(input.pageSize, 1, 20, 20);
    const pageToken = this.cursor(input.pageToken);
    const token = await this.token(credentials);
    const url = new URL("/v1alpha1/investors/firms", this.apiOrigin);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await this.request(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    const body = await this.body(response);
    if (!response.ok) throw this.httpError(response.status, "API");
    if (!Array.isArray(body.firms))
      throw new CartaApiError(
        "provider_validation_error",
        "Carta returned an invalid firm directory.",
        502,
      );
    return {
      firms: body.firms
        .slice(0, pageSize)
        .map((entry) => this.object(entry))
        .map((firm) => ({
          id: this.id(firm.id),
          name: this.text(firm.name, 1_000),
        }))
        .filter((firm) => firm.id),
      pageSize,
      nextPageToken: this.outputCursor(body.nextPageToken),
    };
  }

  private async token(credentials: CartaCredentials) {
    const clientId = this.credential(credentials.clientId, "client ID");
    const clientSecret = this.credential(
      credentials.clientSecret,
      "client secret",
    );
    const form = new URLSearchParams({
      scope: CARTA_SCOPE,
      grant_type: "CLIENT_CREDENTIALS",
    });
    const response = await this.request(
      new URL("/o/access_token/", this.loginOrigin),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    const body = await this.body(response, 100_000);
    if (!response.ok) throw this.httpError(response.status, "token service");
    const accessToken = this.text(body.access_token, 20_000);
    if (!accessToken || /[\r\n]/.test(accessToken))
      throw new CartaApiError(
        "credential_missing",
        "Carta did not return a valid access token.",
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
      throw new CartaApiError(
        "provider_unavailable",
        "Carta API could not be reached.",
        502,
      );
    }
  }

  private httpError(status: number, service: string) {
    return new CartaApiError(
      status === 429
        ? "provider_rate_limited"
        : status >= 500
          ? "provider_unavailable"
          : status === 401 || status === 403
            ? "credential_missing"
            : "provider_validation_error",
      `Carta ${service} returned HTTP ${status}.`,
      status || 400,
    );
  }

  private credential(value: string, label: string) {
    if (!value || value.length > 2_000 || /[\r\n:]/.test(value))
      throw new CartaApiError(
        "credential_missing",
        `A valid Carta ${label} is required.`,
        401,
      );
    return value;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new CartaApiError(
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
      throw new CartaApiError(
        "provider_validation_error",
        "Carta page token is invalid.",
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

  private async body(response: Response, max = 250_000) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > max)
      throw new CartaApiError(
        "provider_validation_error",
        "Carta response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return {};
    }
  }

  private id(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9-]{1,50}$/.test(value)
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
