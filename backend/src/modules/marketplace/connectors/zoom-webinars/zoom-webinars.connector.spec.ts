import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  ZoomWebinarsApiAdapter,
  type ZoomWebinarsCredentials,
} from "./zoom-webinars-api.adapter";
import {
  ZOOM_WEBINARS_CONNECTOR_MANIFEST,
  ZOOM_WEBINARS_REQUIRED_SCOPE,
} from "./zoom-webinars.connector";
const credentials: ZoomWebinarsCredentials = {
  accountId: "zoom-webinars-account-fixture",
  clientId: "zoom-webinars-client-fixture",
  clientSecret: "zoom-webinars-secret-fixture",
  hostId: "licensed-host-fixture",
};
const token = () =>
  new Response(
    JSON.stringify({
      access_token: "zoom-webinars-access-fixture",
      expires_in: 3600,
      scope: ZOOM_WEBINARS_REQUIRED_SCOPE,
    }),
    { status: 200 },
  );
describe("Zoom Webinars Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("registers exact-scope host-bound S2S credentials and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("zoom-webinars")).toBe(
      ZOOM_WEBINARS_CONNECTOR_MANIFEST,
    );
    expect(
      ZOOM_WEBINARS_CONNECTOR_MANIFEST.healthChecks[0].requiredScopes,
    ).toEqual([ZOOM_WEBINARS_REQUIRED_SCOPE]);
    expect(
      ZOOM_WEBINARS_CONNECTOR_MANIFEST.approvalProfiles.map((p) => p.id),
    ).toEqual(["zoom_webinars_safe", "dangerously_skip_permissions"]);
  });
  it("pins one bounded request to the configured host", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ webinars: [] }), { status: 200 }),
      );
    await new ZoomWebinarsApiAdapter().listLifecycle(credentials, {
      limit: 999,
    });
    const url = new URL(String(fetchMock.mock.calls[1][0]));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://api.zoom.us/v2/users/licensed-host-fixture/webinars",
    );
    expect(url.searchParams.get("page_size")).toBe("25");
    expect(url.searchParams.get("include_events_webinar")).toBe("false");
  });
  it("returns content-free lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            webinars: [
              {
                agenda: "Private agenda",
                topic: "Private topic",
                host_id: "private-host",
                id: 123456789,
                uuid: "private-uuid",
                join_url: "https://zoom.us/private",
                start_time: "2026-07-20T10:00:00Z",
                timezone: "Europe/London",
                duration: 60,
                type: 9,
                is_simulive: true,
                is_events_webinar: false,
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new ZoomWebinarsApiAdapter().listLifecycle(
      credentials,
      {},
    );
    expect(result.webinars[0]).toEqual({
      startTime: "2026-07-20T10:00:00.000Z",
      timezone: "Europe/London",
      durationMinutes: 60,
      type: 9,
      simulive: true,
      eventsWebinar: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("123456789");
  });
  it("rejects an unsafe configured host before provider access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new ZoomWebinarsApiAdapter().listLifecycle(
        { ...credentials, hostId: "../../users" },
        {},
      ),
    ).rejects.toMatchObject({ code: "credential_missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
