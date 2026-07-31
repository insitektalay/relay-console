import { MarketplaceConnectorRegistry } from "../connector-registry";
import { GoToWebinarApiAdapter } from "./goto-webinar-api.adapter";
import {
  GOTO_WEBINAR_CONNECTOR_MANIFEST,
  GOTO_WEBINAR_REQUIRED_SCOPES,
} from "./goto-webinar.connector";

describe("GoTo Webinar Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers exact scopes, rotating OAuth, and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("goto-webinar")).toBe(
      GOTO_WEBINAR_CONNECTOR_MANIFEST,
    );
    expect(GOTO_WEBINAR_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      requiredScopes: [...GOTO_WEBINAR_REQUIRED_SCOPES],
      supportsRefresh: true,
    });
    expect(
      GOTO_WEBINAR_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["goto_webinar_safe", "dangerously_skip_permissions"]);
  });

  it("binds the organizer and pins one bounded first-page window", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 12345 })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ _embedded: { webinars: [] } })),
      );
    await new GoToWebinarApiAdapter().listLifecycle("access-fixture", {
      limit: 999,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.getgo.com/identity/v1/Users/me",
    );
    const url = new URL(String(fetchMock.mock.calls[1][0]));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://api.getgo.com/G2W/rest/v2/organizers/12345/webinars",
    );
    expect(url.searchParams.get("page")).toBe("0");
    expect(url.searchParams.get("size")).toBe("25");
    expect(url.searchParams.has("fromTime")).toBe(true);
    expect(url.searchParams.has("toTime")).toBe(true);
  });

  it("returns content-free webinar lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "12345" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            _embedded: {
              webinars: [
                {
                  webinarKey: 999,
                  webinarID: "123-456-789",
                  subject: "Private subject",
                  description: "Private description",
                  registrationUrl: "https://private.example",
                  organizerEmail: "private@example.com",
                  coorganizers: [{ email: "private@example.com" }],
                  times: [
                    {
                      startTime: "2026-08-01T10:00:00Z",
                      endTime: "2026-08-01T11:00:00Z",
                    },
                  ],
                  timeZone: "Europe/London",
                  experienceType: "broadcast",
                  inSession: false,
                  impromptu: false,
                  isOndemand: true,
                },
              ],
            },
          }),
        ),
      );
    const result = await new GoToWebinarApiAdapter().listLifecycle(
      "access-fixture",
      {},
    );
    expect(result.webinars[0]).toEqual({
      times: [
        {
          startTime: "2026-08-01T10:00:00.000Z",
          endTime: "2026-08-01T11:00:00.000Z",
        },
      ],
      timeZone: "Europe/London",
      experienceType: "broadcast",
      inSession: false,
      impromptu: false,
      onDemand: true,
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("999");
  });

  it("fails closed when organizer identity is unusable", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "not-numeric" })));
    await expect(
      new GoToWebinarApiAdapter().listLifecycle("access-fixture", {}),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
