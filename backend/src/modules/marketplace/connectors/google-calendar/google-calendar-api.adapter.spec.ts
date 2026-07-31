import {
  GoogleCalendarApiAdapter,
  type GoogleCalendarCredentials,
} from "./google-calendar-api.adapter";

const credentials: GoogleCalendarCredentials = {
  accessToken: "calendar-access",
  accountEmail: "relay@example.com",
  defaultCalendarId: "primary",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("GoogleCalendarApiAdapter", () => {
  it("binds the primary account and exact default calendar", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(response({ id: "relay@example.com" }))
      .mockResolvedValueOnce(response({ id: "relay@example.com" }));
    await expect(
      new GoogleCalendarApiAdapter(requester).health(credentials),
    ).resolves.toMatchObject({
      accountEmail: "relay@example.com",
      defaultCalendarId: "primary",
    });
    expect(requester).toHaveBeenCalledTimes(2);
  });

  it("lists bounded events without following page tokens or returning risky fields", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        nextPageToken: "must-not-follow",
        items: [
          {
            id: "evt_1",
            etag: '"etag-1"',
            summary: "Planning",
            start: { dateTime: "2026-07-17T10:00:00Z" },
            end: { dateTime: "2026-07-17T10:30:00Z" },
            attendees: [
              { email: "person@example.com", responseStatus: "accepted" },
            ],
            attachments: [{ fileUrl: "must-not-leak" }],
            conferenceData: { entryPoints: [{ uri: "must-not-leak" }] },
            extendedProperties: { private: { secret: "must-not-leak" } },
          },
        ],
      }),
    );
    const result = await new GoogleCalendarApiAdapter(requester).listEvents(
      credentials,
      {
        calendarId: "primary",
        timeMin: "2026-07-17T00:00:00Z",
        timeMax: "2026-07-18T00:00:00Z",
        limit: 5,
      },
    );
    expect(result).toMatchObject({
      limit: 5,
      automaticPagination: false,
      events: [{ id: "evt_1", summary: "Planning" }],
    });
    expect(requester).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(/must-not-follow|must-not-leak/);
  });

  it("queries bounded FreeBusy without event details", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        timeMin: "2026-07-17T09:00:00Z",
        timeMax: "2026-07-17T17:00:00Z",
        calendars: {
          primary: {
            busy: [
              {
                start: "2026-07-17T10:00:00Z",
                end: "2026-07-17T10:30:00Z",
              },
            ],
          },
        },
      }),
    );
    const result = await new GoogleCalendarApiAdapter(requester).queryFreeBusy(
      credentials,
      {
        calendarIds: ["primary"],
        timeMin: "2026-07-17T09:00:00Z",
        timeMax: "2026-07-17T17:00:00Z",
      },
    );
    expect(result).toMatchObject({
      eventDetailsReturned: false,
      busy: [{ calendarId: "primary" }],
    });
    expect(JSON.parse(String(requester.mock.calls[0][1].body))).toMatchObject({
      calendarExpansionMax: 10,
      groupExpansionMax: 0,
    });
  });

  it("creates and updates reviewed fields with side effects disabled and ETag protection", async () => {
    const requester = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(response({ id: "evt_1", etag: '"etag-2"' })),
      );
    const adapter = new GoogleCalendarApiAdapter(requester);
    await adapter.createEvent(credentials, {
      calendarId: "primary",
      summary: "Planning",
      start: { dateTime: "2026-07-17T10:00:00Z" },
      end: { dateTime: "2026-07-17T10:30:00Z" },
      attendees: [{ email: "person@example.com" }],
    });
    expect(requester.mock.calls[0][0]).toContain(
      "sendUpdates=none&supportsAttachments=false&conferenceDataVersion=0",
    );
    await adapter.updateEvent(credentials, {
      calendarId: "primary",
      eventId: "evt_1",
      etag: '"etag-1"',
      summary: "Updated planning",
    });
    expect(requester.mock.calls[1][1].headers).toMatchObject({
      "If-Match": '"etag-1"',
    });
    expect(JSON.parse(String(requester.mock.calls[1][1].body))).toEqual({
      summary: "Updated planning",
    });
  });

  it("maps binding mismatches and quota responses safely", async () => {
    await expect(
      new GoogleCalendarApiAdapter(
        jest.fn().mockResolvedValue(response({ id: "other@example.com" })),
      ).health(credentials),
    ).rejects.toMatchObject({
      code: "google_calendar_account_binding_mismatch",
    });
    await expect(
      new GoogleCalendarApiAdapter(
        jest.fn().mockResolvedValue(response({}, 429)),
      ).listCalendars(credentials, {}),
    ).rejects.toMatchObject({ code: "google_calendar_rate_limited" });
  });
});
