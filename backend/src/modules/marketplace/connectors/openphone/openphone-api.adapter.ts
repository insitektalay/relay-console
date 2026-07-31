import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type OpenPhoneCredentials = { apiKey: string };

export class OpenPhoneApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class OpenPhoneApiAdapter {
  private readonly endpoint = "https://api.openphone.com/v1/phone-numbers";
  private readonly maxResponseBytes = 512 * 1024;

  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: OpenPhoneCredentials) {
    const numbers = this.phoneNumbers(await this.request(credentials.apiKey));
    return {
      apiOrigin: "https://api.openphone.com",
      numberCount: numbers.length,
      keyValidated: true,
    };
  }

  async listPhoneNumbers(credentials: OpenPhoneCredentials) {
    const source = this.phoneNumbers(await this.request(credentials.apiKey));
    const numbers = source.slice(0, 10).map((record) => ({
      name: record.name,
      phoneNumber: this.maskPhone(record.phoneNumber),
    }));
    return { numbers, count: numbers.length, truncated: source.length > 10 };
  }

  private phoneNumbers(value: unknown) {
    const body = this.object(value);
    if (!Array.isArray(body.data))
      throw this.invalid("Quo returned an invalid phone-number list");
    return body.data.map((value) => {
      const record = this.object(value);
      const name = this.text(record.name, 100);
      const phoneNumber =
        this.text(record.formattedNumber, 64) ?? this.text(record.number, 64);
      if (!name || !phoneNumber)
        throw this.invalid("Quo returned an invalid phone-number record");
      return { name, phoneNumber };
    });
  }

  private async request(apiKeyInput: string) {
    const apiKey = apiKeyInput.trim();
    if (!apiKey || apiKey.length > 16_000 || /[\r\n]/.test(apiKey))
      throw new OpenPhoneApiError(
        "credential_missing",
        "A valid Quo workspace API key is required",
        401,
      );
    let response: Response;
    try {
      response = await this.requester(this.endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: apiKey,
          "User-Agent": "RelayConsole-Quo/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new OpenPhoneApiError(
        "provider_unavailable",
        "Quo could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new OpenPhoneApiError(
        this.errorCode(response.status),
        `Quo returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private text(value: unknown, maxLength: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maxLength)
      : null;
  }
  private maskPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) throw this.invalid("Quo returned an invalid phone number");
    return `${value.startsWith("+") ? "+" : ""}••••${digits.slice(-4)}`;
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Quo response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new OpenPhoneApiError(
        "provider_unavailable",
        "Quo response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Quo response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Quo returned invalid JSON");
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
    return new OpenPhoneApiError("provider_validation_error", message, 400);
  }
}
