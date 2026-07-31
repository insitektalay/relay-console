import { MarketplaceConnectorRegistry } from "../connector-registry";
import { HARVEST_CONNECTOR_MANIFEST } from "./harvest.connector";
import { HarvestApiAdapter, HarvestApiError } from "./harvest-api.adapter";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Harvest Marketplace connector", () => {
  it("registers the exact single-account authorization-code lifecycle", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("harvest")).toBe(HARVEST_CONNECTOR_MANIFEST);
    expect(HARVEST_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://id.getharvest.com/oauth2/authorize",
      tokenUrl: "https://id.getharvest.com/api/v2/oauth2/token",
      requiredScopes: [],
      pkce: false,
      supportsRefresh: true,
    });
  });

  it("keeps bounded reads direct and the full V2 API behind Safe approval", () => {
    expect(HARVEST_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      HARVEST_CONNECTOR_MANIFEST.tools.filter((tool) => tool.approvalRequired),
    ).toHaveLength(1);
    expect(
      HARVEST_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["harvest_full_api"]);
  });

  it("pins every request to the exact account header and connected user", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new HarvestApiAdapter(async (url, init) => {
      requests.push({ url: String(url), init });
      return response({
        time_entries: [
          {
            id: 91,
            user: { id: 42 },
            spent_date: "2026-07-17",
            project: { id: 7, name: "Relay" },
            client: { id: 8, name: "ClawChat" },
            task: { id: 9, name: "Engineering" },
            hours: 1.5,
          },
        ],
      });
    });
    const result = await adapter.listTimeEntries(
      { accessToken: "access", accountId: "123", userId: "42" },
      { from: "2026-07-01", to: "2026-07-17", limit: 10 },
    );
    expect(result.timeEntries[0]).toMatchObject({
      timeEntryId: "91",
      userId: "42",
    });
    expect(requests[0].url).toContain("user_id=42");
    expect(
      new Headers(requests[0].init.headers).get("Harvest-Account-Id"),
    ).toBe("123");
  });

  it("rejects account rebinding and credential-bearing full API fields", async () => {
    const adapter = new HarvestApiAdapter(async () => response({}));
    await expect(
      adapter.request(
        { accessToken: "access", accountId: "123", userId: "42" },
        { method: "GET", path: "/users/me", query: { account_id: "999" } },
      ),
    ).rejects.toMatchObject<Partial<HarvestApiError>>({
      code: "policy_blocked",
    });
    await expect(
      adapter.request(
        { accessToken: "access", accountId: "123", userId: "42" },
        { method: "GET", path: "/../oauth/token" },
      ),
    ).rejects.toMatchObject<Partial<HarvestApiError>>({
      code: "provider_validation_error",
    });
  });
});
