import { MarketplaceConnectorRegistry } from "../connector-registry";
import { BizzaboApiAdapter } from "./bizzabo-api.adapter";
import { BIZZABO_CONNECTOR_MANIFEST } from "./bizzabo.connector";
const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
describe("Bizzabo Marketplace connector", () => {
  it("registers one encrypted API key and two bounded reads", () => {
    expect(new MarketplaceConnectorRegistry().get("bizzabo")).toBe(
      BIZZABO_CONNECTOR_MANIFEST,
    );
    expect(
      BIZZABO_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["BIZZABO_API_KEY"]);
    expect(BIZZABO_CONNECTOR_MANIFEST.tools).toHaveLength(2);
  });
  it("pins page zero, the requested bound and bearer auth", async () => {
    let url = "";
    let headers = new Headers();
    const adapter = new BizzaboApiAdapter(async (requestUrl, init) => {
      url = String(requestUrl);
      headers = new Headers(init.headers);
      return response({
        content: [
          {
            id: "event-1",
            name: "Summit",
            attendeeEmail: "hidden@example.com",
          },
        ],
      });
    });
    const result = await adapter.listEvents(
      { apiToken: "token" },
      { limit: 7 },
    );
    expect(url).toBe("https://api.bizzabo.com/v1/events?page=0&size=7");
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(JSON.stringify(result)).not.toContain("hidden@example.com");
  });
  it("rejects unsafe identifiers before a request", async () => {
    const requester = jest.fn();
    const adapter = new BizzaboApiAdapter(requester);
    await expect(
      adapter.getEvent({ apiToken: "token" }, { eventId: "../attendees" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(requester).not.toHaveBeenCalled();
  });
});
