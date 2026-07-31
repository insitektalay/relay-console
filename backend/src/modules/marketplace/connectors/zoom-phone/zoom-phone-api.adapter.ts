import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { ZOOM_PHONE_REQUIRED_SCOPE } from "./zoom-phone.connector";

type JsonObject = Record<string, unknown>;
export type ZoomPhoneCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

export class ZoomPhoneApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ZoomPhoneApiAdapter {
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number; scopes: string[] }
  >();

  async health(credentials: ZoomPhoneCredentials) {
    const result = await this.listNumbers(credentials, { limit: 1 });
    return { authorized: true, sampleCount: result.numbers.length };
  }

  async listNumbers(credentials: ZoomPhoneCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const token = await this.accessToken(credentials);
    const url = new URL("https://api.zoom.us/v2/number_management/numbers");
    url.searchParams.set("allocated_product", "ZOOM_PHONE");
    url.searchParams.set("page_size", String(limit));
    const body = await this.fetchJson(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const numbers = this.array(body.numbers)
      .slice(0, limit)
      .map((value) => this.shape(value));
    return {
      numbers,
      count: numbers.length,
      allocatedProduct: "ZOOM_PHONE",
      nextPageUsed: false,
      completeInventory: false,
    };
  }

  private async accessToken(credentials: ZoomPhoneCredentials) {
    this.require(credentials.accountId, "Zoom account ID");
    this.require(credentials.clientId, "Zoom client ID");
    this.require(credentials.clientSecret, "Zoom client secret");
    const key = createHash("sha256")
      .update(
        `${credentials.accountId}\0${credentials.clientId}\0${credentials.clientSecret}`,
      )
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000)
      return cached.accessToken;
    const url = new URL("https://zoom.us/oauth/token");
    url.searchParams.set("grant_type", "account_credentials");
    url.searchParams.set("account_id", credentials.accountId);
    const authorization = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
      "utf8",
    ).toString("base64");
    const body = await this.fetchJson(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const accessToken = this.text(body.access_token, 30_000);
    const expiresIn = Number(body.expires_in);
    const scopes =
      this.text(body.scope, 10_000)?.split(/\s+/).filter(Boolean) ?? [];
    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn < 1)
      throw new ZoomPhoneApiError(
        "token_refresh_failed",
        "Zoom did not return a usable access token.",
      );
    if (!scopes.includes(ZOOM_PHONE_REQUIRED_SCOPE))
      throw new ZoomPhoneApiError(
        "insufficient_scope",
        `Zoom Phone requires ${ZOOM_PHONE_REQUIRED_SCOPE}.`,
        403,
      );
    this.tokens.set(key, {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 3_600) * 1_000,
      scopes,
    });
    return accessToken;
  }

  private shape(value: unknown) {
    const number = this.object(value);
    return {
      numberMasked: this.maskNumber(number.number),
      allocatedProduct:
        this.enumText(number.allocated_product, ["ZOOM_PHONE"]) ?? "ZOOM_PHONE",
      numberType: this.enumText(number.number_type, [
        "Toll",
        "TollFree",
        "VirtualService",
        "Mobile",
        "SharedCost",
        "National",
        "ITFS",
      ]),
      source: this.enumText(number.source, [
        "Zoom",
        "ZoomPorted",
        "ZoomReserved",
        "ThirdPartyNumber",
        "BYOCCloud",
        "BYOCPremises",
      ]),
      status: this.enumText(number.status, ["Normal", "Pending"]),
      capabilities: this.array(number.capability)
        .slice(0, 5)
        .flatMap((item) => {
          const value = this.enumText(item, [
            "Incoming",
            "Outgoing",
            "Messaging",
            "PCIPal",
            "EmergencyCalls",
          ]);
          return value ? [value] : [];
        }),
      addressUpdateRequired:
        typeof number.address_update_required === "boolean"
          ? number.address_update_required
          : null,
      assignmentTypes: Array.from(
        new Set(
          this.array(number.assigned_list).flatMap((item) => {
            const value = this.text(this.object(item).assigned_to_type, 80);
            return value ? [value] : [];
          }),
        ),
      ).slice(0, 10),
    };
  }

  private async fetchJson(url: URL, init: RequestInit) {
    const allowed =
      (url.origin === "https://zoom.us" && url.pathname === "/oauth/token") ||
      (url.origin === "https://api.zoom.us" &&
        url.pathname === "/v2/number_management/numbers");
    if (!allowed)
      throw new ZoomPhoneApiError(
        "policy_blocked",
        "Zoom Phone request left its fixed endpoint boundary.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, { ...init, cache: "no-store" });
    } catch (error) {
      throw new ZoomPhoneApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Zoom Phone request timed out."
          : "Zoom Phone could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new ZoomPhoneApiError(
        "provider_validation_error",
        "Zoom Phone returned more than 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const body = this.object(parsed);
    if (!response.ok)
      throw new ZoomPhoneApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    return body;
  }

  private require(value: string, label: string) {
    if (!value)
      throw new ZoomPhoneApiError(
        "credential_missing",
        `${label} is required.`,
        401,
      );
  }
  private maskNumber(value: unknown) {
    const number =
      typeof value === "string" ? value.replace(/[^0-9+]/g, "") : "";
    const digits = number.replace(/\D/g, "");
    if (!digits) return null;
    return `${number.startsWith("+") ? "+" : ""}${"*".repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
  }
  private limit(value: unknown) {
    const number = Number(value ?? 25);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), 1), 25)
      : 25;
  }
  private enumText(value: unknown, allowed: string[]) {
    const text = this.text(value, 80);
    return text && allowed.includes(text) ? text : null;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
      : null;
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
      return "Zoom Phone authorization is invalid or expired.";
    if (status === 403)
      return `Zoom Phone requires ${ZOOM_PHONE_REQUIRED_SCOPE} and an authorized account role.`;
    if (status === 429) return "Zoom rate limited the Zoom Phone request.";
    if (status >= 500) return "Zoom Phone is temporarily unavailable.";
    return "Zoom rejected the Zoom Phone request.";
  }
}
