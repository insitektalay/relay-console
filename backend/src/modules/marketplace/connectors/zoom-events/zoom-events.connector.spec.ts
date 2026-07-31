import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  ZoomEventsApiAdapter,
  type ZoomEventsCredentials,
} from "./zoom-events-api.adapter";
import {
  ZOOM_EVENTS_CONNECTOR_MANIFEST,
  ZOOM_EVENTS_REQUIRED_SCOPE,
} from "./zoom-events.connector";
const credentials: ZoomEventsCredentials = {
  accountId: "zoom-events-account-fixture",
  clientId: "zoom-events-client-fixture",
  clientSecret: "zoom-events-secret-fixture",
};
const token = () =>
  new Response(
    JSON.stringify({
      access_token: "zoom-events-access-fixture",
      expires_in: 3600,
      scope: ZOOM_EVENTS_REQUIRED_SCOPE,
    }),
    { status: 200 },
  );
describe("Zoom Events Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("registers exact-scope S2S credentials and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("zoom-events")).toBe(
      ZOOM_EVENTS_CONNECTOR_MANIFEST,
    );
    expect(
      ZOOM_EVENTS_CONNECTOR_MANIFEST.healthChecks[0].requiredScopes,
    ).toEqual([ZOOM_EVENTS_REQUIRED_SCOPE]);
    expect(
      ZOOM_EVENTS_CONNECTOR_MANIFEST.approvalProfiles.map((p) => p.id),
    ).toEqual(["zoom_events_safe", "dangerously_skip_permissions"]);
  });
  it("pins one bounded event-list request", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ events: [] }), { status: 200 }),
      );
    await new ZoomEventsApiAdapter().listLifecycle(credentials, { limit: 999 });
    const url = new URL(String(fetchMock.mock.calls[1][0]));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://api.zoom.us/v2/zoom_events/events",
    );
    expect(url.searchParams.get("page_size")).toBe("25");
  });
  it("returns content-free lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            events: [
              {
                event_id: "private-event",
                name: "Private name",
                description: "Private description",
                hub_id: "private-hub",
                contact_email: "private@example.com",
                event_url: "https://private.example",
                tags: ["private-tag"],
                event_type: "CONFERENCE",
                access_level: "PRIVATE_RESTRICTED",
                attendance_type: "hybrid",
                meeting_type: "WEBINAR",
                status: "PUBLISHED",
                start_time: "2026-07-20T10:00:00Z",
                end_time: "2026-07-20T12:00:00Z",
                timezone: "Europe/London",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new ZoomEventsApiAdapter().listLifecycle(
      credentials,
      {},
    );
    expect(result.events[0]).toEqual({
      eventType: "CONFERENCE",
      accessLevel: "PRIVATE_RESTRICTED",
      attendanceType: "hybrid",
      meetingType: "WEBINAR",
      status: "PUBLISHED",
      startTime: "2026-07-20T10:00:00.000Z",
      endTime: "2026-07-20T12:00:00.000Z",
      timezone: "Europe/London",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("example.com");
  });
  it("rejects a token without exact granular scope", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "zoom-events-access-fixture",
            expires_in: 3600,
            scope: "zoom_events_basic:read:admin",
          }),
          { status: 200 },
        ),
      );
    await expect(
      new ZoomEventsApiAdapter().listLifecycle(credentials, {}),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});
