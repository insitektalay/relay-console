export const GOOGLE_CALENDAR_API_ORIGIN =
  "https://www.googleapis.com/calendar/v3";
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.freebusy",
  "https://www.googleapis.com/auth/calendar.events",
];

export type GoogleCalendarCredentials = {
  accessToken: string;
  accountEmail: string;
  defaultCalendarId: string;
};

export class GoogleCalendarApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class GoogleCalendarApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: GoogleCalendarCredentials) {
    const primary = this.record(
      await this.request(credentials, "/users/me/calendarList/primary", "GET"),
    );
    const account = this.email(primary.id);
    if (account.toLowerCase() !== credentials.accountEmail.toLowerCase())
      throw new GoogleCalendarApiError(
        "google_calendar_account_binding_mismatch",
        "Google Calendar primary account binding changed.",
        403,
      );
    await this.request(
      credentials,
      `/calendars/${this.path(credentials.defaultCalendarId)}`,
      "GET",
    );
    return {
      ready: true,
      accountEmail: account,
      defaultCalendarId: credentials.defaultCalendarId,
    };
  }

  async listCalendars(
    credentials: GoogleCalendarCredentials,
    input: Record<string, unknown>,
  ) {
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(
        credentials,
        `/users/me/calendarList?maxResults=${limit}&showDeleted=false&showHidden=false`,
        "GET",
      ),
    );
    return {
      calendars: this.array(root.items)
        .slice(0, limit)
        .map((value) => this.calendar(value)),
      limit,
      automaticPagination: false,
      aclReturned: false,
    };
  }

  async listEvents(
    credentials: GoogleCalendarCredentials,
    input: Record<string, unknown>,
  ) {
    const calendarId = this.calendarId(input.calendarId);
    const timeMin = this.timestamp(input.timeMin, "timeMin");
    const timeMax = this.timestamp(input.timeMax, "timeMax");
    if (Date.parse(timeMin) >= Date.parse(timeMax))
      throw new GoogleCalendarApiError(
        "google_calendar_time_range_invalid",
        "Google Calendar timeMin must be before timeMax.",
        400,
      );
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: String(limit),
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
    });
    const root = this.record(
      await this.request(
        credentials,
        `/calendars/${this.path(calendarId)}/events?${query.toString()}`,
        "GET",
      ),
    );
    return {
      calendarId,
      events: this.array(root.items)
        .slice(0, limit)
        .map((value) => this.event(value)),
      limit,
      automaticPagination: false,
      attachmentsReturned: false,
      conferenceDataReturned: false,
    };
  }

  async queryFreeBusy(
    credentials: GoogleCalendarCredentials,
    input: Record<string, unknown>,
  ) {
    const timeMin = this.timestamp(input.timeMin, "timeMin");
    const timeMax = this.timestamp(input.timeMax, "timeMax");
    if (Date.parse(timeMin) >= Date.parse(timeMax))
      throw new GoogleCalendarApiError(
        "google_calendar_time_range_invalid",
        "Google Calendar timeMin must be before timeMax.",
        400,
      );
    const ids = this.array(input.calendarIds).map((value) =>
      this.calendarId(value),
    );
    if (!ids.length || ids.length > 10 || new Set(ids).size !== ids.length)
      throw new GoogleCalendarApiError(
        "google_calendar_ids_invalid",
        "Google Calendar FreeBusy requires 1 through 10 unique calendars.",
        400,
      );
    const timeZone =
      input.timeZone === undefined
        ? undefined
        : this.requiredText(input.timeZone, 100, "timeZone");
    const root = this.record(
      await this.request(credentials, "/freeBusy", "POST", {
        timeMin,
        timeMax,
        ...(timeZone ? { timeZone } : {}),
        calendarExpansionMax: 10,
        groupExpansionMax: 0,
        items: ids.map((id) => ({ id })),
      }),
    );
    const calendars = this.record(root.calendars);
    const busy = ids.flatMap((calendarId) =>
      this.array(this.record(calendars[calendarId]).busy)
        .slice(0, 25)
        .map((value) => {
          const interval = this.record(value);
          return {
            calendarId,
            start: this.text(interval.start, 64),
            end: this.text(interval.end, 64),
          };
        }),
    );
    return {
      timeMin: this.text(root.timeMin, 64) || timeMin,
      timeMax: this.text(root.timeMax, 64) || timeMax,
      busy: busy.slice(0, 100),
      automaticPagination: false,
      eventDetailsReturned: false,
    };
  }

  async createEvent(
    credentials: GoogleCalendarCredentials,
    input: Record<string, unknown>,
  ) {
    const calendarId = this.calendarId(input.calendarId);
    const event = this.writePayload(input, true);
    return {
      calendarId,
      event: this.event(
        await this.request(
          credentials,
          `/calendars/${this.path(calendarId)}/events?sendUpdates=none&supportsAttachments=false&conferenceDataVersion=0`,
          "POST",
          event,
        ),
      ),
      guestNotificationsSent: false,
    };
  }

  async updateEvent(
    credentials: GoogleCalendarCredentials,
    input: Record<string, unknown>,
  ) {
    const calendarId = this.calendarId(input.calendarId);
    const eventId = this.eventId(input.eventId);
    const etag = this.requiredText(input.etag, 500, "etag");
    const event = this.writePayload(input, false);
    return {
      calendarId,
      event: this.event(
        await this.request(
          credentials,
          `/calendars/${this.path(calendarId)}/events/${this.path(eventId)}?sendUpdates=none&supportsAttachments=false&conferenceDataVersion=0`,
          "PATCH",
          event,
          etag,
        ),
      ),
      guestNotificationsSent: false,
    };
  }

  private async request(
    credentials: GoogleCalendarCredentials,
    path: string,
    method: "GET" | "POST" | "PATCH",
    body?: unknown,
    etag?: string,
  ) {
    if (
      !/^\/(?:users\/me\/calendarList(?:\/primary|\?maxResults=(?:[1-9]|1[0-9]|2[0-5])&showDeleted=false&showHidden=false)|calendars\/[A-Za-z0-9%_.~@-]{1,960}(?:\/events(?:\?[A-Za-z0-9%&=+_.:-]{1,1200}|\/[A-Za-z0-9%_.~@-]{1,3072}\?[A-Za-z0-9%&=+_.:-]{1,1200})?)?|freeBusy)$/.test(
        path,
      )
    )
      throw new GoogleCalendarApiError(
        "google_calendar_path_invalid",
        "Google Calendar API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new GoogleCalendarApiError(
        "google_calendar_credential_missing",
        "Google Calendar OAuth access token is missing.",
        401,
      );
    const response = await this.requester(
      `${GOOGLE_CALENDAR_API_ORIGIN}${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(etag ? { "If-Match": etag } : {}),
          "User-Agent": "RelayConsole-GoogleCalendar/1.0",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const code =
        response.status === 401
          ? "google_calendar_token_invalid"
          : response.status === 403
            ? "google_calendar_scope_or_acl_denied"
            : response.status === 404
              ? "google_calendar_resource_not_found"
              : response.status === 409 || response.status === 412
                ? "google_calendar_conflict"
                : response.status === 429
                  ? "google_calendar_rate_limited"
                  : "google_calendar_unavailable";
      throw new GoogleCalendarApiError(
        code,
        "Google Calendar API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new GoogleCalendarApiError(
        "google_calendar_response_too_large",
        "Google Calendar response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new GoogleCalendarApiError(
        "google_calendar_response_invalid",
        "Google Calendar returned an invalid response.",
      );
    }
  }

  private writePayload(
    input: Record<string, unknown>,
    requireSummary: boolean,
  ) {
    const result: Record<string, unknown> = {};
    if (input.summary !== undefined)
      result.summary = this.requiredText(input.summary, 500, "summary");
    else if (requireSummary)
      throw new GoogleCalendarApiError(
        "google_calendar_summary_invalid",
        "Google Calendar summary is required.",
        400,
      );
    for (const key of ["description", "location"] as const) {
      if (input[key] !== undefined)
        result[key] = this.requiredText(input[key], 4_000, key);
    }
    if (input.start !== undefined)
      result.start = this.eventTime(input.start, "start");
    else if (requireSummary)
      throw new GoogleCalendarApiError(
        "google_calendar_start_invalid",
        "Google Calendar start is required.",
        400,
      );
    if (input.end !== undefined) result.end = this.eventTime(input.end, "end");
    else if (requireSummary)
      throw new GoogleCalendarApiError(
        "google_calendar_end_invalid",
        "Google Calendar end is required.",
        400,
      );
    if (input.attendees !== undefined) {
      const attendees = this.array(input.attendees);
      if (attendees.length > 25)
        throw new GoogleCalendarApiError(
          "google_calendar_attendees_invalid",
          "Google Calendar allows at most 25 attendees.",
          400,
        );
      result.attendees = attendees.map((value) => ({
        email: this.email(this.record(value).email),
      }));
    }
    if (!Object.keys(result).length)
      throw new GoogleCalendarApiError(
        "google_calendar_patch_empty",
        "Google Calendar update requires at least one changed field.",
        400,
      );
    return result;
  }

  private calendar(value: unknown) {
    const row = this.record(value);
    return {
      id: this.text(row.id, 320),
      summary: this.text(row.summary, 1_000),
      descriptionExcerpt: this.text(row.description, 2_000),
      timeZone: this.text(row.timeZone, 100),
      accessRole: this.text(row.accessRole, 100),
      primary: row.primary === true,
      selected: row.selected === true,
      aclReturned: false,
      notificationSettingsReturned: false,
    };
  }

  private event(value: unknown) {
    const row = this.record(value);
    const organizer = this.person(row.organizer);
    return {
      id: this.text(row.id, 1_024),
      etag: this.text(row.etag, 500),
      status: this.text(row.status, 100),
      summary: this.text(row.summary, 500),
      descriptionExcerpt: this.text(row.description, 4_000),
      location: this.text(row.location, 1_000),
      start: this.readTime(row.start),
      end: this.readTime(row.end),
      eventType: this.text(row.eventType, 100),
      recurrence: this.array(row.recurrence)
        .slice(0, 10)
        .map((item) => this.text(item, 1_000)),
      organizer,
      attendees: this.array(row.attendees)
        .slice(0, 25)
        .map((item) => this.person(item)),
      htmlLink: this.text(row.htmlLink, 2_000),
      updated: this.text(row.updated, 64),
      attachmentsReturned: false,
      conferenceDataReturned: false,
      privateExtendedPropertiesReturned: false,
    };
  }

  private person(value: unknown) {
    const row = this.record(value);
    return {
      email: this.text(row.email, 320),
      displayName: this.text(row.displayName, 500),
      responseStatus: this.text(row.responseStatus, 100),
      self: row.self === true,
    };
  }

  private readTime(value: unknown) {
    const row = this.record(value);
    return {
      date: this.text(row.date, 32),
      dateTime: this.text(row.dateTime, 64),
      timeZone: this.text(row.timeZone, 100),
    };
  }

  private eventTime(value: unknown, name: string) {
    const row = this.record(value);
    const date = this.text(row.date, 32);
    const dateTime = this.text(row.dateTime, 64);
    if ((date ? 1 : 0) + (dateTime ? 1 : 0) !== 1)
      throw new GoogleCalendarApiError(
        `google_calendar_${name}_invalid`,
        `Google Calendar ${name} requires exactly one date or dateTime.`,
        400,
      );
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new GoogleCalendarApiError(
        `google_calendar_${name}_invalid`,
        `Google Calendar ${name} date is invalid.`,
        400,
      );
    if (dateTime && !Number.isFinite(Date.parse(dateTime)))
      throw new GoogleCalendarApiError(
        `google_calendar_${name}_invalid`,
        `Google Calendar ${name} dateTime is invalid.`,
        400,
      );
    const timeZone = this.text(row.timeZone, 100);
    return {
      ...(date ? { date } : { dateTime }),
      ...(timeZone ? { timeZone } : {}),
    };
  }

  private timestamp(value: unknown, name: string) {
    const text = this.requiredText(value, 64, name);
    if (!Number.isFinite(Date.parse(text)))
      throw new GoogleCalendarApiError(
        `google_calendar_${name}_invalid`,
        `Google Calendar ${name} must be RFC3339.`,
        400,
      );
    return text;
  }

  private calendarId(value: unknown) {
    return this.requiredText(value, 320, "calendarId");
  }

  private eventId(value: unknown) {
    const text = this.requiredText(value, 1_024, "eventId");
    if (!/^[A-Za-z0-9_-]+$/.test(text))
      throw new GoogleCalendarApiError(
        "google_calendar_event_id_invalid",
        "Google Calendar eventId is invalid.",
        400,
      );
    return text;
  }

  private path(value: string) {
    return encodeURIComponent(value);
  }

  private email(value: unknown) {
    const text = this.text(value, 320);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
      throw new GoogleCalendarApiError(
        "google_calendar_email_invalid",
        "Google Calendar email address is invalid.",
        400,
      );
    return text;
  }

  private limit(value: unknown) {
    const limit = value === undefined ? 10 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new GoogleCalendarApiError(
        "google_calendar_limit_invalid",
        "Google Calendar limit must be an integer from 1 through 25.",
        400,
      );
    return limit;
  }

  private requiredText(value: unknown, max: number, name: string) {
    const text = this.text(value, max + 1).trim();
    if (
      !text ||
      text.length > max ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)
    )
      throw new GoogleCalendarApiError(
        `google_calendar_${name}_invalid`,
        `Google Calendar ${name} is invalid.`,
        400,
      );
    return text;
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }
}
