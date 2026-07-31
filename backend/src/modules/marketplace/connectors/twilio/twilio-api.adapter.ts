import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type TwilioCredentials = {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
};

export class TwilioApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TwilioApiAdapter {
  private readonly maxResponseBytes = 512 * 1024;
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: TwilioCredentials) {
    await this.request(credentials, 1);
    return { apiOrigin: "https://api.twilio.com", keyValidated: true };
  }

  async listMessageStatuses(credentials: TwilioCredentials) {
    const source = this.messages(await this.request(credentials, 10));
    const messageStatuses = source.slice(0, 10).map((record) => ({
      direction: this.allowlisted(record.direction, [
        "inbound",
        "outbound-api",
        "outbound-call",
        "outbound-reply",
      ]),
      status: this.allowlisted(record.status, [
        "accepted",
        "scheduled",
        "canceled",
        "queued",
        "sending",
        "sent",
        "failed",
        "delivered",
        "undelivered",
        "receiving",
        "received",
        "read",
      ]),
      from: this.maskAddress(record.from),
      to: this.maskAddress(record.to),
      date: this.date(record.date_sent) ?? this.date(record.date_created),
    }));
    return {
      messageStatuses,
      count: messageStatuses.length,
      truncated: source.length > 10,
    };
  }

  private messages(value: unknown) {
    const body = this.object(value);
    if (!Array.isArray(body.messages))
      throw this.invalid("Twilio returned an invalid Messages list");
    return body.messages.map((value) => this.object(value));
  }

  private async request(credentials: TwilioCredentials, pageSize: 1 | 10) {
    const accountSid = credentials.accountSid.trim();
    const apiKeySid = credentials.apiKeySid.trim();
    const apiKeySecret = credentials.apiKeySecret.trim();
    if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid))
      throw new TwilioApiError(
        "credential_missing",
        "A valid Twilio Account SID is required",
        401,
      );
    if (!/^SK[0-9a-fA-F]{32}$/.test(apiKeySid))
      throw new TwilioApiError(
        "credential_missing",
        "A valid Twilio Restricted API Key SID is required",
        401,
      );
    if (
      !apiKeySecret ||
      apiKeySecret.length > 16_000 ||
      /[\r\n]/.test(apiKeySecret)
    )
      throw new TwilioApiError(
        "credential_missing",
        "A valid Twilio Restricted API Key secret is required",
        401,
      );
    const endpoint =
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json` +
      `?PageSize=${pageSize}&Page=0`;
    let response: Response;
    try {
      response = await this.requester(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64")}`,
          "User-Agent": "RelayConsole-Twilio/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new TwilioApiError(
        "provider_unavailable",
        "Twilio could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new TwilioApiError(
        this.errorCode(response.status),
        `Twilio returned HTTP ${response.status}`,
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
  private allowlisted(value: unknown, allowed: string[]) {
    const normalized = this.text(value, 64)?.toLowerCase();
    return normalized && allowed.includes(normalized) ? normalized : "unknown";
  }
  private maskAddress(value: unknown) {
    const address = this.text(value, 160);
    if (!address) return "not-provided";
    const suffix = address.replace(/\s/g, "").slice(-4);
    return suffix ? `••••${suffix}` : "not-provided";
  }
  private date(value: unknown) {
    const date = this.text(value, 64);
    if (!date || Number.isNaN(Date.parse(date))) return null;
    return new Date(date).toISOString();
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Twilio response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new TwilioApiError(
        "provider_unavailable",
        "Twilio response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Twilio response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Twilio returned invalid JSON");
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
    return new TwilioApiError("provider_validation_error", message, 400);
  }
}
