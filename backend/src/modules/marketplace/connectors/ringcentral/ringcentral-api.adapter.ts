import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class RingCentralApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RingCentralApiAdapter {
  private readonly baseUrl =
    "https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/call-log";
  private readonly maxResponseBytes = 512 * 1024;

  async listCallLog(accessToken: string, limitInput: unknown = 10) {
    const limit = this.limit(limitInput);
    const body = this.object(
      await this.request(accessToken, `?view=Simple&perPage=${limit}`),
    );
    if (!Array.isArray(body.records))
      throw this.invalid("RingCentral returned an invalid call-log collection");
    const records = body.records
      .slice(0, limit)
      .map((value) => this.shapeRecord(value));
    const navigation = this.object(body.navigation);
    return {
      records,
      truncated:
        body.records.length > limit ||
        Object.keys(this.object(navigation.nextPage)).length > 0,
    };
  }

  async getCallLogRecord(accessToken: string, recordIdInput: unknown) {
    const recordId = this.recordId(recordIdInput);
    const firstTen = await this.listCallLog(accessToken, 10);
    if (!firstTen.records.some((record) => record.id === recordId))
      throw new RingCentralApiError(
        "provider_validation_error",
        "Call-log record is not in the connected extension's first ten recent records",
        403,
      );
    const record = this.shapeRecord(
      await this.request(
        accessToken,
        `/${encodeURIComponent(recordId)}?view=Simple`,
      ),
    );
    if (record.id !== recordId)
      throw this.invalid(
        "RingCentral returned a different call-log record than requested",
      );
    return record;
  }

  private async request(accessTokenInput: string, suffix: string) {
    const accessToken = accessTokenInput.trim();
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new RingCentralApiError(
        "credential_missing",
        "A valid RingCentral OAuth access token is required",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.baseUrl}${suffix}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-RingCentral/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new RingCentralApiError(
        "provider_unavailable",
        "RingCentral could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new RingCentralApiError(
        this.errorCode(response.status),
        `RingCentral returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private shapeRecord(value: unknown) {
    const record = this.object(value);
    const id = this.safeIdentifier(record.id);
    if (!id)
      throw this.invalid("RingCentral returned an incomplete call-log record");
    return {
      id,
      startTime: this.optionalDateTime(record.startTime, "startTime"),
      duration: this.duration(record.duration),
      type: this.text(record.type, 32),
      direction: this.enumValue(record.direction, ["Inbound", "Outbound"]),
      action: this.text(record.action, 64),
      result: this.text(record.result, 64),
      from: this.shapeParty(record.from),
      to: this.shapeParty(record.to),
    };
  }

  private shapeParty(value: unknown) {
    const party = this.object(value);
    return { phoneNumber: this.maskPhone(party.phoneNumber) };
  }

  private maskPhone(value: unknown) {
    const text = this.text(value, 64);
    if (!text) return null;
    const digits = text.replace(/\D/g, "");
    if (!digits) return null;
    return `${text.startsWith("+") ? "+" : ""}••••${digits.slice(-4)}`;
  }

  private recordId(value: unknown) {
    const id = this.safeIdentifier(value);
    if (!id)
      throw this.invalid(
        "recordId must be a safe RingCentral call-log record ID",
      );
    return id;
  }

  private safeIdentifier(value: unknown) {
    const id = this.text(value, 128);
    return id && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
  }

  private limit(value: unknown) {
    if (value == null) return 10;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 10
    )
      throw this.invalid("limit must be an integer from 1 through 10");
    return value;
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

  private optionalDateTime(value: unknown, field: string) {
    if (value == null || value === "") return null;
    const text = this.text(value, 64);
    if (
      !text ||
      Number.isNaN(Date.parse(text)) ||
      !/(?:Z|[+-]\d{2}:?\d{2})$/.test(text)
    )
      throw this.invalid(`${field} must be an ISO 8601 date-time with offset`);
    return text;
  }

  private duration(value: unknown) {
    return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 31_536_000
      ? value
      : null;
  }

  private enumValue(value: unknown, allowed: string[]) {
    const text = this.text(value, 32);
    return text && allowed.includes(text) ? text : null;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("RingCentral response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new RingCentralApiError(
        "provider_unavailable",
        "RingCentral response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("RingCentral response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("RingCentral returned invalid JSON");
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
    return new RingCentralApiError("provider_validation_error", message, 400);
  }
}
