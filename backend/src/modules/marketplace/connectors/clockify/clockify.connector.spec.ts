import { MarketplaceConnectorRegistry } from "../connector-registry";
import { ClockifyApiAdapter } from "./clockify-api.adapter";
import { CLOCKIFY_CONNECTOR_MANIFEST } from "./clockify.connector";

describe("Clockify Marketplace connector", () => {
  it("registers a customer-owned personal API-key contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("clockify")).toBe(CLOCKIFY_CONNECTOR_MANIFEST);
    expect(CLOCKIFY_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "CLOCKIFY_API_KEY",
          secret: true,
          storedIn: "encrypted_secret",
        }),
        expect.objectContaining({
          name: "CLOCKIFY_API_BASE_URL",
          secret: false,
          required: false,
        }),
      ],
    });
  });

  it("keeps bounded reads direct and the wider APIs behind Safe approval", () => {
    expect(CLOCKIFY_CONNECTOR_MANIFEST.tools).toHaveLength(5);
    expect(
      CLOCKIFY_CONNECTOR_MANIFEST.tools.filter((tool) => tool.approvalRequired),
    ).toHaveLength(1);
    expect(
      CLOCKIFY_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["clockify_full_api"]);
  });

  it("validates the key and binds the user on the fixed regular API origin", async () => {
    const adapter = new ClockifyApiAdapter(async (url, init) => {
      expect(String(url)).toBe("https://api.clockify.me/api/v1/user");
      expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe(
        "personal-key",
      );
      return new Response(
        JSON.stringify({ id: "user_123", activeWorkspace: "workspace_456" }),
        { status: 200 },
      );
    });
    await expect(
      adapter.health({
        apiKey: "personal-key",
        apiBaseUrl: "https://api.clockify.me/api/v1",
      }),
    ).resolves.toEqual({
      userId: "user_123",
      activeWorkspace: "workspace_456",
      apiOrigin: "https://api.clockify.me/api/v1",
    });
  });

  it("routes reports through the matching regional Clockify origin", async () => {
    const adapter = new ClockifyApiAdapter(async (url) => {
      expect(String(url)).toBe(
        "https://euc1.clockify.me/report/v1/workspaces/workspace_456/reports/summary",
      );
      return new Response(JSON.stringify({ totals: [] }), { status: 200 });
    });
    await adapter.request(
      {
        apiKey: "personal-key",
        apiBaseUrl: "https://euc1.clockify.me/api/v1",
        userId: "user_123",
      },
      {
        surface: "reports",
        method: "POST",
        path: "/workspaces/workspace_456/reports/summary",
        json: {},
      },
    );
  });

  it("bounds time windows and blocks credential lifecycle routes", async () => {
    const adapter = new ClockifyApiAdapter(
      async () => new Response("[]", { status: 200 }),
    );
    const credentials = {
      apiKey: "personal-key",
      apiBaseUrl: "https://api.clockify.me/api/v1",
      userId: "user_123",
    };
    await expect(
      adapter.listTimeEntries(credentials, {
        workspaceId: "workspace_456",
        startDate: "2026-01-01T00:00:00Z",
        endDate: "2026-07-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        surface: "regular",
        method: "POST",
        path: "/api-keys",
        json: {},
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
