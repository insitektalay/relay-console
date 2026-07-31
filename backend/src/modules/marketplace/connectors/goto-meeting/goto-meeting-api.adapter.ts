import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GoToMeetingApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GoToMeetingApiAdapter {
  private readonly baseUrl = "https://api.getgo.com/G2M/rest";
  private readonly maxResponseBytes = 512 * 1024;

  async listUpcomingMeetings(
    accessToken: string,
    organizerKeyInput: unknown,
    limitInput: unknown = 10,
  ) {
    const organizerKey = this.numericId(organizerKeyInput, "organizerKey");
    const limit = this.limit(limitInput);
    const body = await this.request(
      accessToken,
      `/organizers/${encodeURIComponent(organizerKey)}/upcomingMeetings`,
    );
    if (!Array.isArray(body))
      throw this.invalid("GoTo Meeting returned an invalid Meeting collection");
    return {
      meetings: body.slice(0, limit).map((value) => this.shapeMeeting(value)),
      truncated: body.length > limit,
    };
  }

  async getMeeting(
    accessToken: string,
    organizerKeyInput: unknown,
    meetingIdInput: unknown,
  ) {
    const organizerKey = this.numericId(organizerKeyInput, "organizerKey");
    const meetingId = this.numericId(meetingIdInput, "meetingId");
    const firstTen = await this.listUpcomingMeetings(
      accessToken,
      organizerKey,
      10,
    );
    if (!firstTen.meetings.some((meeting) => meeting.meetingId === meetingId))
      throw new GoToMeetingApiError(
        "provider_validation_error",
        "Meeting is not in the connected organizer's first ten upcoming Meetings",
        403,
      );
    const body = await this.request(
      accessToken,
      `/meetings/${encodeURIComponent(meetingId)}`,
    );
    const value = Array.isArray(body) ? body[0] : body;
    const meeting = this.shapeMeeting(value);
    if (meeting.meetingId !== meetingId)
      throw this.invalid(
        "GoTo Meeting returned a different Meeting than requested",
      );
    return meeting;
  }

  private async request(accessTokenInput: string, path: string) {
    const accessToken = accessTokenInput.trim();
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new GoToMeetingApiError(
        "credential_missing",
        "A valid GoTo OAuth access token is required",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-GoToMeeting/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new GoToMeetingApiError(
        "provider_unavailable",
        "GoTo Meeting could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new GoToMeetingApiError(
        this.errorCode(response.status),
        `GoTo Meeting returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private shapeMeeting(value: unknown) {
    const meeting = this.object(value);
    const meetingId =
      this.identifier(meeting.meetingId) ?? this.identifier(meeting.meetingid);
    const subject = this.text(meeting.subject, 100);
    if (!meetingId || !subject)
      throw this.invalid("GoTo Meeting returned an incomplete Meeting");
    return {
      meetingId,
      subject,
      startTime: this.optionalDateTime(meeting.startTime, "startTime"),
      endTime: this.optionalDateTime(meeting.endTime, "endTime"),
      duration: this.duration(meeting.duration),
      meetingType: this.enumValue(meeting.meetingType, [
        "immediate",
        "recurring",
        "scheduled",
      ]),
      status: this.enumValue(meeting.status, ["ACTIVE", "INACTIVE"]),
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
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.text(value, 20);
    return text && /^[0-9]{1,20}$/.test(text) ? text : null;
  }

  private numericId(value: unknown, field: string) {
    const id = this.identifier(value);
    if (!id) throw this.invalid(`${field} must be a numeric GoTo Meeting ID`);
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

  private optionalDateTime(value: unknown, field: string) {
    if (value === "" || value == null) return null;
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
      value <= 525_600
      ? value
      : null;
  }

  private enumValue(value: unknown, allowed: string[]) {
    const text = this.text(value, 100);
    return text && allowed.includes(text) ? text : null;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("GoTo Meeting response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new GoToMeetingApiError(
        "provider_unavailable",
        "GoTo Meeting response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("GoTo Meeting response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("GoTo Meeting returned invalid JSON");
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
    return new GoToMeetingApiError("provider_validation_error", message, 400);
  }
}
