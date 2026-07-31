import { MarketplaceConnectorRegistry } from "../connector-registry";
import { TogglTrackApiAdapter } from "./toggl-track-api.adapter";
import { TOGGL_TRACK_CONNECTOR_MANIFEST } from "./toggl-track.connector";

describe("Toggl Track Marketplace connector", () => {
  it("registers a customer-owned personal API-token contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("toggl-track")).toBe(TOGGL_TRACK_CONNECTOR_MANIFEST);
    expect(TOGGL_TRACK_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "TOGGL_TRACK_API_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ],
    });
  });

  it("keeps bounded reads direct and the wider API behind Safe approval", () => {
    expect(TOGGL_TRACK_CONNECTOR_MANIFEST.tools).toHaveLength(5);
    expect(
      TOGGL_TRACK_CONNECTOR_MANIFEST.tools.filter(
        (tool) => tool.approvalRequired,
      ),
    ).toHaveLength(1);
    expect(
      TOGGL_TRACK_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["toggl_track_full_api"]);
  });

  it("uses the documented token:api_token Basic header on the fixed v9 origin", async () => {
    const adapter = new TogglTrackApiAdapter(async (url, init) => {
      expect(String(url)).toBe("https://api.track.toggl.com/api/v9/me");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        `Basic ${Buffer.from("personal-token:api_token").toString("base64")}`,
      );
      return new Response(JSON.stringify({ id: 42 }), { status: 200 });
    });
    await expect(
      adapter.health({ apiToken: "personal-token" }),
    ).resolves.toEqual({
      userId: 42,
      apiOrigin: "https://api.track.toggl.com/api/v9",
    });
  });

  it("bounds time windows and blocks credential lifecycle routes", async () => {
    const adapter = new TogglTrackApiAdapter(
      async () => new Response("[]", { status: 200 }),
    );
    await expect(
      adapter.listTimeEntries(
        { apiToken: "personal-token" },
        {
          startDate: "2026-01-01T00:00:00Z",
          endDate: "2026-07-01T00:00:00Z",
        },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(
        { apiToken: "personal-token" },
        { method: "PUT", path: "/me/password", json: {} },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
