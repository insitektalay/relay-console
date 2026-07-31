import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class AircallApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AircallApiAdapter {
  private readonly origin = "https://api.aircall.io/v1";
  private readonly maxResponseBytes = 512 * 1024;

  async getIntegrationBinding(accessToken: string) {
    const integrationBody = this.object(
      await this.request(accessToken, "/integrations/me"),
    );
    const integration = this.object(integrationBody.integration);
    const companyBody = this.object(
      await this.request(accessToken, "/company"),
    );
    const company = this.object(companyBody.company);
    const integrationId = this.integerString(integration.id);
    const companyId = this.integerString(integration.company_id);
    const companyName = this.text(company.name, 100);
    if (!integrationId || !companyId || !companyName)
      throw this.invalid("Aircall did not return a useful company binding");
    return {
      integrationId,
      companyId,
      companyName,
      usersCount: this.count(company.users_count),
      numbersCount: this.count(company.numbers_count),
      active: integration.active === true || integration.status === "active",
    };
  }

  async listNumbers(accessToken: string) {
    const body = this.object(
      await this.request(accessToken, "/numbers?page=1&per_page=10"),
    );
    const source = this.array(body.numbers);
    const numbers = source.slice(0, 10).map((value) => {
      const number = this.object(value);
      const name = this.text(number.name, 100);
      const digits = this.text(number.digits, 64);
      const country = this.text(number.country, 2)?.toUpperCase();
      const availabilityStatus = this.text(number.availability_status, 16);
      if (!name || !digits || !country || !/^[A-Z]{2}$/.test(country))
        throw this.invalid("Aircall returned an invalid phone-number record");
      return {
        name,
        phoneNumber: this.maskPhone(digits),
        country,
        availabilityStatus:
          availabilityStatus &&
          ["open", "custom", "closed"].includes(availabilityStatus)
            ? availabilityStatus
            : "unknown",
      };
    });
    return { numbers, count: numbers.length, truncated: source.length > 10 };
  }

  private async request(accessTokenInput: string, path: string) {
    const accessToken = accessTokenInput.trim();
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new AircallApiError(
        "credential_missing",
        "A valid Aircall OAuth access token is required",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.origin}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Aircall/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AircallApiError(
        "provider_unavailable",
        "Aircall could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new AircallApiError(
        this.errorCode(response.status),
        `Aircall returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown, maxLength: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maxLength)
      : null;
  }
  private integerString(value: unknown) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
      return String(value);
    const text = this.text(value, 32);
    return text && /^[1-9][0-9]*$/.test(text) ? text : null;
  }
  private count(value: unknown) {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
  }
  private maskPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) throw this.invalid("Aircall returned an invalid phone number");
    return `${value.startsWith("+") ? "+" : ""}••••${digits.slice(-4)}`;
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Aircall response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new AircallApiError(
        "provider_unavailable",
        "Aircall response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Aircall response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Aircall returned invalid JSON");
      return {};
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "token_expired";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new AircallApiError("provider_validation_error", message, 400);
  }
}
