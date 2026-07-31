import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  CommonRoomApiAdapter,
  CommonRoomApiError,
} from "./common-room-api.adapter";
import { COMMON_ROOM_CONNECTOR_MANIFEST } from "./common-room.connector";

describe("Common Room Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { apiToken: "room.jwt.token" };

  it("registers encrypted customer-token auth and both runtime policy profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("common-room")).toBe(
      COMMON_ROOM_CONNECTOR_MANIFEST,
    );
    expect(COMMON_ROOM_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        {
          name: "COMMON_ROOM_API_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    });
    expect(
      COMMON_ROOM_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["common_room_safe", "dangerously_skip_permissions"]);
  });

  it("pins bounded reads to api.commonroom.io and header-only bearer auth", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
        }),
      );
    await new CommonRoomApiAdapter().listSegments(credentials, {
      limit: 999,
      query: "champions",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.commonroom.io/api/v2/segments?limit=100&query=champions",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer room.jwt.token",
    );
    expect(String(init?.body ?? "")).not.toContain("room.jwt.token");
  });

  it("rejects arbitrary origins, traversal and credential-bearing payloads", async () => {
    const adapter = new CommonRoomApiAdapter();
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.test/api/v2/segments",
      }),
    ).rejects.toBeInstanceOf(CommonRoomApiError);
    await expect(
      adapter.request(credentials, { method: "GET", path: "/api/v2/../admin" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/v2/segments",
        json: { apiToken: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts private and secret-shaped provider fields", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "s_1",
                email: "private@example.com",
                accessToken: "hidden",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new CommonRoomApiAdapter().listSegments(
      credentials,
      {},
    );
    expect(result).toEqual({
      data: [{ id: "s_1", email: "[redacted]", accessToken: "[redacted]" }],
    });
  });
});
