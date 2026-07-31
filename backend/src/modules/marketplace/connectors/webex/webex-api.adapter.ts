import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class WebexApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WebexApiAdapter {
  private readonly baseUrl = "https://webexapis.com/v1";
  private readonly maxResponseBytes = 512 * 1024;

  async listMeetings(accessToken: string, limitInput: unknown = 10) {
    const limit = this.limit(limitInput);
    const response = await this.request(accessToken, `/meetings?max=${limit}`);
    const body = this.object(response.body);
    if (!Array.isArray(body.items))
      throw this.invalid("Webex returned an invalid Meeting collection");
    return {
      meetings: body.items
        .slice(0, limit)
        .map((value) => this.shapeMeeting(value)),
      truncated: this.hasNextPage(response.linkHeader),
    };
  }

  async getMeeting(accessToken: string, meetingIdInput: unknown) {
    const meetingId = this.meetingId(meetingIdInput);
    const firstPage = await this.listMeetings(accessToken, 10);
    if (!firstPage.meetings.some((meeting) => meeting.meetingId === meetingId))
      throw new WebexApiError(
        "provider_validation_error",
        "Meeting is not on the connected Person's first bounded page",
        403,
      );
    const response = await this.request(
      accessToken,
      `/meetings/${encodeURIComponent(meetingId)}`,
    );
    const meeting = this.shapeMeeting(response.body);
    if (meeting.meetingId !== meetingId)
      throw this.invalid("Webex returned a different Meeting than requested");
    return meeting;
  }

  private async request(accessTokenInput: string, path: string) {
    const accessToken = accessTokenInput.trim();
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new WebexApiError(
        "credential_missing",
        "A valid Webex OAuth access token is required",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Webex/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new WebexApiError(
        "provider_unavailable",
        "Webex could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new WebexApiError(
        this.errorCode(response.status),
        `Webex returned HTTP ${response.status}`,
        response.status,
      );
    return { body, linkHeader: response.headers.get("link") };
  }

  private shapeMeeting(value: unknown) {
    const meeting = this.object(value);
    const meetingId = this.identifier(meeting.id);
    const title = this.text(meeting.title, 500);
    const start = this.dateTime(meeting.start, "start");
    const end = this.dateTime(meeting.end, "end");
    if (!meetingId || !title)
      throw this.invalid("Webex returned an incomplete Meeting");
    return {
      meetingId,
      title,
      meetingType: this.enumValue(meeting.meetingType, [
        "meetingSeries",
        "scheduledMeeting",
        "meeting",
      ]),
      state: this.text(meeting.state, 100),
      timezone: this.timezone(meeting.timezone),
      start,
      end,
      recurrence: this.text(meeting.recurrence, 500),
      enabledAutoRecordMeeting: meeting.enabledAutoRecordMeeting === true,
    };
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

  private identifier(value: unknown) {
    const text = this.text(value, 256);
    return text && /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
  }

  private meetingId(value: unknown) {
    const id = this.identifier(value);
    if (!id) throw this.invalid("meetingId must be a safe Webex Meeting ID");
    return id;
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

  private dateTime(value: unknown, field: string) {
    const text = this.text(value, 64);
    if (
      !text ||
      Number.isNaN(Date.parse(text)) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(text)
    )
      throw this.invalid(`${field} must be an ISO 8601 date-time with offset`);
    return text;
  }

  private timezone(value: unknown) {
    const text = this.text(value, 100);
    return text && /^[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(text)
      ? text
      : null;
  }

  private enumValue(value: unknown, allowed: string[]) {
    const text = this.text(value, 100);
    return text && allowed.includes(text) ? text : null;
  }

  private hasNextPage(linkHeader: string | null) {
    return Boolean(linkHeader && /rel=["']?next["']?/i.test(linkHeader));
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Webex response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new WebexApiError(
        "provider_unavailable",
        "Webex response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Webex response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Webex returned invalid JSON");
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
    return new WebexApiError("provider_validation_error", message, 400);
  }
}
