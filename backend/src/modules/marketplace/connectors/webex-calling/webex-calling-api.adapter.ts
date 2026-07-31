import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class WebexCallingApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WebexCallingApiAdapter {
  async health(accessToken: string) {
    const result = await this.listNumbers(accessToken, { limit: 1 });
    return { authorized: true, sampleCount: result.numbers.length };
  }

  async listNumbers(accessToken: string, input: JsonObject) {
    if (!accessToken) {
      throw new WebexCallingApiError(
        "credential_missing",
        "Webex Calling OAuth access is required.",
        401,
      );
    }
    const limit = this.limit(input.limit);
    const url = new URL("https://webexapis.com/v1/telephony/config/numbers");
    url.searchParams.set("max", String(limit));
    const body = await this.fetchJson(url, accessToken);
    const numbers = this.array(body.items)
      .slice(0, limit)
      .map((item) => this.shape(item));
    return {
      numbers,
      count: numbers.length,
      nextPageUsed: false,
      completeInventory: false,
    };
  }

  private shape(value: unknown) {
    const number = this.object(value);
    return {
      maskedNumber: this.mask(number.phoneNumber),
      maskedExtension: this.mask(number.extension),
      state: this.enumText(number.state, ["ACTIVE", "INACTIVE"]),
      phoneNumberType: this.enumText(number.phoneNumberType, [
        "PRIMARY",
        "ALTERNATE",
        "FAX",
        "DNIS",
        "Default",
      ]),
      includedTelephonyTypes: this.telephonyTypes(
        number.includedTelephonyTypes,
      ),
      mainNumber: number.mainNumber === true,
      tollFreeNumber: number.tollFreeNumber === true,
      serviceNumber: number.isServiceNumber === true,
      emergencyLocationIdentificationNumber: number.elinEnabled === true,
      reservedNumber: number.isReservedNumber === true,
      locationAssigned: this.hasObjectValue(number.location),
      ownerAssigned: this.hasObjectValue(number.owner),
    };
  }

  private async fetchJson(url: URL, accessToken: string) {
    if (
      url.origin !== "https://webexapis.com" ||
      url.pathname !== "/v1/telephony/config/numbers"
    ) {
      throw new WebexCallingApiError(
        "policy_blocked",
        "Webex Calling request left its fixed endpoint boundary.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new WebexCallingApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Webex Calling request timed out."
          : "Webex Calling could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000) {
      throw new WebexCallingApiError(
        "provider_validation_error",
        "Webex Calling returned more than 1 MB.",
      );
    }
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      throw new WebexCallingApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    }
    return this.object(parsed);
  }

  private mask(value: unknown) {
    if (typeof value !== "string") return null;
    const digits = value.replace(/\D/g, "");
    return digits ? `••••${digits.slice(-2).padStart(2, "•")}` : null;
  }

  private telephonyTypes(value: unknown) {
    const allowed = new Set(["PSTN_NUMBER", "MOBILE_NUMBER"]);
    const values = Array.isArray(value) ? value : [value];
    return Array.from(
      new Set(
        values.filter(
          (entry): entry is string =>
            typeof entry === "string" && allowed.has(entry),
        ),
      ),
    );
  }

  private hasObjectValue(value: unknown) {
    return Object.keys(this.object(value)).length > 0;
  }

  private enumText(value: unknown, allowed: string[]) {
    return typeof value === "string" && allowed.includes(value) ? value : null;
  }

  private limit(value: unknown) {
    const number = Number(value ?? 25);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), 1), 25)
      : 25;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private safeMessage(status: number) {
    if (status === 401)
      return "Webex Calling authorization is invalid or expired.";
    if (status === 403)
      return "Webex Calling requires spark-admin:telephony_config_read, an eligible administrator, and a Calling-enabled organization.";
    if (status === 429) return "Webex rate limited the Calling request.";
    if (status >= 500) return "Webex Calling is temporarily unavailable.";
    return "Webex rejected the Calling request.";
  }
}
