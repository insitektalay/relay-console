import { MarketplaceConnectorRegistry } from "../connector-registry";
import { GoldcastApiAdapter } from "./goldcast-api.adapter";
import { GOLDCAST_CONNECTOR_MANIFEST } from "./goldcast.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Goldcast Marketplace connector", () => {
  it("registers a customer-owned encrypted API token and two bounded reads", () => {
    expect(new MarketplaceConnectorRegistry().get("goldcast")).toBe(
      GOLDCAST_CONNECTOR_MANIFEST,
    );
    expect(GOLDCAST_CONNECTOR_MANIFEST.auth).toMatchObject({ type: "api_key" });
    expect(GOLDCAST_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "relay_goldcast_list_events",
      "relay_goldcast_get_event",
    ]);
    expect(
      GOLDCAST_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toContain("dangerously_skip_permissions");
  });

  it("pins event listing to one bounded page and sends the token only as bearer auth", async () => {
    let requestUrl = "";
    let headers = new Headers();
    const adapter = new GoldcastApiAdapter(async (url, init) => {
      requestUrl = String(url);
      headers = new Headers(init.headers);
      return response({
        results: [
          {
            id: "event-1",
            name: "Launch",
            status: "published",
            email: "hidden@example.com",
          },
        ],
      });
    });
    const result = await adapter.listEvents(
      { apiToken: "secret-token" },
      { limit: 7 },
    );
    expect(requestUrl).toBe("https://customapi.goldcast.io/event/?page_size=7");
    expect(headers.get("authorization")).toBe("Bearer secret-token");
    expect(JSON.stringify(result)).not.toContain("hidden@example.com");
  });

  it("rejects unsafe event identifiers before making a request", async () => {
    const requester = jest.fn();
    const adapter = new GoldcastApiAdapter(requester);
    await expect(
      adapter.getEvent({ apiToken: "token" }, { eventId: "../people" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(requester).not.toHaveBeenCalled();
  });
});
