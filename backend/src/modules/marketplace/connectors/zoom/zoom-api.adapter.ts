import { Injectable } from "@nestjs/common";

export class ZoomApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const ORIGIN = "https://api.zoom.us";
const SAFE_MEETING_ID = /^\d{1,32}$/;

@Injectable()
export class ZoomApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(token: string) {
    await this.get(token, "/v2/users/me/meetings?type=scheduled&page_size=1");
    return { reachable: true, selfUserOnly: true, metadataOnly: true };
  }

  async listScheduledMeetings(token: string) {
    return this.meetingList(
      await this.get(
        token,
        "/v2/users/me/meetings?type=scheduled&page_size=25",
      ),
      "scheduled",
    );
  }

  async listLiveMeetings(token: string) {
    return this.meetingList(
      await this.get(token, "/v2/users/me/meetings?type=live&page_size=25"),
      "live",
    );
  }

  async listUpcomingMeetings(token: string) {
    return this.meetingList(
      await this.get(token, "/v2/users/me/upcoming_meetings?page_size=25"),
      "next-24-hours",
    );
  }

  async getMeeting(token: string, meetingId: unknown) {
    const id = this.meetingId(meetingId);
    return {
      meeting: this.meeting(
        this.object(await this.get(token, `/v2/meetings/${id}`)),
      ),
    };
  }

  private async get(token: string, pathAndQuery: string) {
    if (!token.trim())
      throw new ZoomApiError(
        "zoom_token_invalid",
        "Zoom connection token is missing.",
      );
    const url = new URL(pathAndQuery, ORIGIN);
    const scheduled = url.pathname === "/v2/users/me/meetings";
    const upcoming = url.pathname === "/v2/users/me/upcoming_meetings";
    const meeting = /^\/v2\/meetings\/\d{1,32}$/.test(url.pathname);
    const validQuery = meeting
      ? url.search === ""
      : scheduled
        ? ["scheduled", "live"].includes(url.searchParams.get("type") ?? "") &&
          ["1", "25"].includes(url.searchParams.get("page_size") ?? "") &&
          [...url.searchParams.keys()].every((key) =>
            ["type", "page_size"].includes(key),
          )
        : upcoming &&
          url.searchParams.get("page_size") === "25" &&
          [...url.searchParams.keys()].every((key) => key === "page_size");
    if (
      url.origin !== ORIGIN ||
      (!scheduled && !upcoming && !meeting) ||
      !validQuery
    )
      throw new ZoomApiError(
        "zoom_path_blocked",
        "Zoom request is outside the fixed self-user meeting GET V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ZoomApiError(
        "zoom_unavailable",
        "Zoom is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new ZoomApiError(
        "zoom_response_too_large",
        "Zoom response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ZoomApiError(
        "zoom_response_invalid",
        "Zoom returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new ZoomApiError(
        response.status === 401
          ? "zoom_token_invalid"
          : response.status === 403
            ? "zoom_permission_denied"
            : response.status === 404
              ? "zoom_not_found"
              : response.status === 429
                ? "zoom_rate_limited"
                : "zoom_api_error",
        "Zoom request failed.",
        response.status,
      );
    return body;
  }

  private meetingList(value: unknown, meetingSet: string) {
    const root = this.object(value);
    const meetings = this.array(root.meetings)
      .slice(0, 25)
      .map((row) => this.meeting(this.object(row)));
    return {
      meetings,
      resultCount: meetings.length,
      meetingSet,
      nextPageFollowed: false,
    };
  }

  private meeting(row: Record<string, unknown>) {
    return {
      id: this.identifier(row.id),
      topic: this.scalar(row.topic, 512),
      agenda: this.scalar(row.agenda, 1_000),
      type: this.number(row.type),
      status: this.scalar(row.status, 64),
      startTime: this.scalar(row.start_time, 64),
      durationMinutes: this.number(row.duration),
      timezone: this.scalar(row.timezone, 128),
      createdAt: this.scalar(row.created_at, 64),
      joinStartRegistrationCredentialsExcluded: true,
      hostPeopleExcluded: true,
      contentAssetsExcluded: true,
    };
  }

  private meetingId(value: unknown) {
    const normalized =
      typeof value === "string"
        ? value
        : typeof value === "number" && Number.isSafeInteger(value)
          ? String(value)
          : "";
    if (!SAFE_MEETING_ID.test(normalized))
      throw new ZoomApiError(
        "zoom_meeting_id_invalid",
        "An explicit numeric prior-result meeting ID is required.",
      );
    return normalized;
  }
  private identifier(value: unknown) {
    const id =
      typeof value === "string"
        ? value
        : typeof value === "number" && Number.isSafeInteger(value)
          ? String(value)
          : "";
    return SAFE_MEETING_ID.test(id) ? id : null;
  }
  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private scalar(value: unknown, max: number): string | null {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private number(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}
