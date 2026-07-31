import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type VonageCredentials = { apiKey: string; apiSecret: string };

export class VonageApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class VonageApiAdapter {
  private readonly endpoint = "https://rest.nexmo.com/account/get-balance";
  private readonly maxResponseBytes = 64 * 1024;
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: VonageCredentials) {
    await this.balance(await this.request(credentials));
    return { apiOrigin: "https://rest.nexmo.com", keyValidated: true };
  }

  async getBalance(credentials: VonageCredentials) {
    return this.balance(await this.request(credentials));
  }

  private balance(value: unknown) {
    const body = this.object(value);
    if (
      typeof body.value !== "number" ||
      !Number.isFinite(body.value) ||
      Math.abs(body.value) > 1_000_000_000 ||
      typeof body.autoReload !== "boolean"
    )
      throw this.invalid("Vonage returned an invalid account balance");
    return {
      balanceEUR: Number(body.value.toFixed(4)),
      autoReloadEnabled: body.autoReload,
    };
  }

  private async request(credentials: VonageCredentials) {
    const apiKey = credentials.apiKey.trim();
    const apiSecret = credentials.apiSecret.trim();
    if (!/^[A-Za-z0-9]{4,32}$/.test(apiKey))
      throw new VonageApiError(
        "credential_missing",
        "A valid Vonage API key is required",
        401,
      );
    if (
      apiSecret.length < 8 ||
      apiSecret.length > 25 ||
      !/[a-z]/.test(apiSecret) ||
      !/[A-Z]/.test(apiSecret) ||
      !/[0-9]/.test(apiSecret) ||
      /[\r\n]/.test(apiSecret)
    )
      throw new VonageApiError(
        "credential_missing",
        "A valid dedicated Vonage API secret is required",
        401,
      );
    let response: Response;
    try {
      response = await this.requester(this.endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
          "User-Agent": "RelayConsole-Vonage/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new VonageApiError(
        "provider_unavailable",
        "Vonage could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new VonageApiError(
        this.errorCode(response.status),
        `Vonage returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Vonage response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new VonageApiError(
        "provider_unavailable",
        "Vonage response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Vonage response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Vonage returned invalid JSON");
      return {};
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new VonageApiError("provider_validation_error", message, 400);
  }
}
