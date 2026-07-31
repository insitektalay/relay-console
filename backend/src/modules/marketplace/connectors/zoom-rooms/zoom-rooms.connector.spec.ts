import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  ZoomRoomsApiAdapter,
  type ZoomRoomsCredentials,
} from "./zoom-rooms-api.adapter";
import {
  ZOOM_ROOMS_CONNECTOR_MANIFEST,
  ZOOM_ROOMS_REQUIRED_SCOPE,
} from "./zoom-rooms.connector";

const credentials: ZoomRoomsCredentials = {
  accountId: "zoom-rooms-account-fixture",
  clientId: "zoom-rooms-client-fixture",
  clientSecret: "zoom-rooms-secret-fixture",
};
const token = () =>
  new Response(
    JSON.stringify({
      access_token: "zoom-rooms-access-fixture",
      expires_in: 3600,
      scope: ZOOM_ROOMS_REQUIRED_SCOPE,
    }),
    { status: 200 },
  );

describe("Zoom Rooms Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("registers exact-scope S2S credentials and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("zoom-rooms")).toBe(
      ZOOM_ROOMS_CONNECTOR_MANIFEST,
    );
    expect(
      ZOOM_ROOMS_CONNECTOR_MANIFEST.healthChecks[0].requiredScopes,
    ).toEqual([ZOOM_ROOMS_REQUIRED_SCOPE]);
    expect(
      ZOOM_ROOMS_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["zoom_rooms_safe", "dangerously_skip_permissions"]);
  });
  it("pins one bounded room-list request", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ rooms: [] }), { status: 200 }),
      );
    await new ZoomRoomsApiAdapter().listFleetHealth(credentials, {
      limit: 999,
    });
    const tokenUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const roomUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(`${tokenUrl.origin}${tokenUrl.pathname}`).toBe(
      "https://zoom.us/oauth/token",
    );
    expect(tokenUrl.searchParams.get("grant_type")).toBe("account_credentials");
    expect(`${roomUrl.origin}${roomUrl.pathname}`).toBe(
      "https://api.zoom.us/v2/rooms",
    );
    expect(roomUrl.searchParams.get("page_size")).toBe("25");
  });
  it("returns anonymous fleet health and drops every identity field", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rooms: [
              {
                activation_code: "private-code",
                id: "private-id",
                room_id: "private-dashboard-id",
                location_id: "private-location",
                user_id: "private-user",
                name: "Private boardroom",
                calendar_resource_id: "private-calendar",
                tag_ids: ["tag-one", "tag-two"],
                status: "Available",
                type: "ZoomRoom",
                pro_device: true,
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new ZoomRoomsApiAdapter().listFleetHealth(
      credentials,
      {},
    );
    expect(result.rooms[0]).toEqual({
      status: "Available",
      type: "ZoomRoom",
      proDevice: true,
      tagCount: 2,
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("boardroom");
    expect(JSON.stringify(result)).not.toContain("tag-one");
  });
  it("rejects a token without the exact granular scope", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "zoom-rooms-access-fixture",
            expires_in: 3600,
            scope: "room:read:admin",
          }),
          { status: 200 },
        ),
      );
    await expect(
      new ZoomRoomsApiAdapter().listFleetHealth(credentials, {}),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});
