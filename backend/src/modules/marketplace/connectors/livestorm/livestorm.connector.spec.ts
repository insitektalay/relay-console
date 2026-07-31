import { MarketplaceConnectorRegistry } from "../connector-registry";
import { LivestormApiAdapter } from "./livestorm-api.adapter";
import {
  LIVESTORM_CONNECTOR_MANIFEST,
  LIVESTORM_REQUIRED_SCOPES,
} from "./livestorm.connector";

describe("Livestorm Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers exact scopes, PKCE refresh OAuth, and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("livestorm")).toBe(
      LIVESTORM_CONNECTOR_MANIFEST,
    );
    expect(LIVESTORM_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      requiredScopes: [...LIVESTORM_REQUIRED_SCOPES],
      pkce: true,
      supportsRefresh: true,
    });
    expect(
      LIVESTORM_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["livestorm_safe", "dangerously_skip_permissions"]);
  });

  it("binds the connected user and pins one bounded first page", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: "1e9d9b14-f990-4e19-a436-9a7dd6a5780a",
              type: "users",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    await new LivestormApiAdapter().listEventLifecycle("access-fixture", {
      limit: 999,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.livestorm.co/v1/me",
    );
    const url = new URL(String(fetchMock.mock.calls[1][0]));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://api.livestorm.co/v1/events",
    );
    expect(url.searchParams.get("page[number]")).toBe("1");
    expect(url.searchParams.get("page[size]")).toBe("25");
    expect([...url.searchParams.keys()].sort()).toEqual([
      "page[number]",
      "page[size]",
    ]);
  });

  it("returns identity-free event lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: "1e9d9b14-f990-4e19-a436-9a7dd6a5780a",
              type: "users",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "29e88fab-7370-47ce-9589-a691c7a2720f",
                type: "events",
                attributes: {
                  title: "Private event",
                  slug: "private-event",
                  description: "Private description",
                  registration_link: "https://private.example",
                  owner: { attributes: { email: "private@example.com" } },
                  scheduling_status: "upcoming",
                  status: "published",
                  estimated_duration: 30,
                  sessions_count: 2,
                  everyone_can_speak: false,
                  registration_page_enabled: true,
                  recording_enabled: true,
                  created_at: 1_643_710_217,
                  updated_at: 1_643_710_219,
                },
              },
            ],
          }),
        ),
      );
    const result = await new LivestormApiAdapter().listEventLifecycle(
      "access-fixture",
      {},
    );
    expect(result.events[0]).toEqual({
      schedulingStatus: "upcoming",
      publicationStatus: "published",
      estimatedDurationMinutes: 30,
      sessionsCount: 2,
      everyoneCanSpeak: false,
      registrationPageEnabled: true,
      recordingEnabled: true,
      createdAt: "2022-02-01T10:10:17.000Z",
      updatedAt: "2022-02-01T10:10:19.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(JSON.stringify(result)).not.toContain("29e88fab");
  });

  it("fails closed when connected-user identity is unusable", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { id: "not-a-user", type: "users" } }),
        ),
      );
    await expect(
      new LivestormApiAdapter().listEventLifecycle("access-fixture", {}),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
