import { ZoomApiAdapter, ZoomApiError } from "./zoom-api.adapter";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("ZoomApiAdapter", () => {
  it("uses only fixed self-user GETs and strips credentials, people, and content", async () => {
    const calls: URL[] = [];
    const adapter = new ZoomApiAdapter(async (url, init) => {
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("error");
      calls.push(new URL(url));
      return response({
        meetings: [
          {
            id: 987654321,
            topic: "Launch readiness",
            agenda: "Review launch state",
            start_time: "2026-07-18T09:00:00Z",
            duration: 30,
            timezone: "UTC",
            join_url: "blocked",
            start_url: "blocked",
            password: "blocked",
            host_email: "blocked@example.com",
            participants: [{ id: "blocked" }],
            recording_files: [{ id: "blocked" }],
          },
        ],
      });
    });

    const scheduled = await adapter.listScheduledMeetings("token");
    const live = await adapter.listLiveMeetings("token");
    const upcoming = await adapter.listUpcomingMeetings("token");
    expect(scheduled.meetings[0]).toMatchObject({
      id: "987654321",
      topic: "Launch readiness",
      joinStartRegistrationCredentialsExcluded: true,
      hostPeopleExcluded: true,
      contentAssetsExcluded: true,
    });
    expect(scheduled.meetings[0]).not.toHaveProperty("join_url");
    expect(scheduled.meetings[0]).not.toHaveProperty("host_email");
    expect(scheduled.meetings[0]).not.toHaveProperty("participants");
    expect(scheduled.meetings[0]).not.toHaveProperty("recording_files");
    expect(live.meetingSet).toBe("live");
    expect(upcoming.meetingSet).toBe("next-24-hours");
    expect(calls.map((url) => `${url.pathname}${url.search}`)).toEqual([
      "/v2/users/me/meetings?type=scheduled&page_size=25",
      "/v2/users/me/meetings?type=live&page_size=25",
      "/v2/users/me/upcoming_meetings?page_size=25",
    ]);
  });

  it("requires an explicit numeric meeting ID and projects one safe meeting", async () => {
    const adapter = new ZoomApiAdapter(async (url) => {
      expect(new URL(url).pathname).toBe("/v2/meetings/987654321");
      return response({
        id: 987654321,
        topic: "Launch readiness",
        join_url: "blocked",
      });
    });
    await expect(adapter.getMeeting("token", "../1")).rejects.toBeInstanceOf(
      ZoomApiError,
    );
    await expect(
      adapter.getMeeting("token", "987654321"),
    ).resolves.toMatchObject({
      meeting: {
        id: "987654321",
        topic: "Launch readiness",
        joinStartRegistrationCredentialsExcluded: true,
      },
    });
  });

  it("maps throttling to a provider-safe error", async () => {
    const adapter = new ZoomApiAdapter(async () => response({}, 429));
    await expect(adapter.listScheduledMeetings("token")).rejects.toMatchObject<
      Partial<ZoomApiError>
    >({
      code: "zoom_rate_limited",
      statusCode: 429,
    });
  });
});
