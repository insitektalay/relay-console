import { MarketplaceConnectorRegistry } from "../connector-registry";
import { EventzillaApiAdapter } from "./eventzilla-api.adapter";
import { EVENTZILLA_CONNECTOR_MANIFEST } from "./eventzilla.connector";

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Eventzilla Marketplace connector", () => {
  it("registers one encrypted API key and two bounded reads", () => {
    expect(new MarketplaceConnectorRegistry().get("eventzilla")).toBe(
      EVENTZILLA_CONNECTOR_MANIFEST,
    );
    expect(
      EVENTZILLA_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["EVENTZILLA_API_KEY"]);
    expect(EVENTZILLA_CONNECTOR_MANIFEST.tools).toHaveLength(2);
  });

  it("pins offset zero, the requested bound and x-api-key auth", async () => {
    let url = "";
    let headers = new Headers();
    const adapter = new EventzillaApiAdapter(async (requestUrl, init) => {
      url = String(requestUrl);
      headers = new Headers(init.headers);
      return response({
        events: [
          {
            id: 2138989212,
            title: "Summit",
            status: "Live",
            email: "hidden@example.com",
            tickets_sold: 14,
          },
        ],
      });
    });
    const result = await adapter.listEvents(
      { apiToken: "token" },
      { limit: 7 },
    );
    expect(url).toBe(
      "https://www.eventzillaapi.net/api/v2/events?offset=0&limit=7",
    );
    expect(headers.get("x-api-key")).toBe("token");
    expect(JSON.stringify(result)).not.toContain("hidden@example.com");
    expect(JSON.stringify(result)).not.toContain("tickets_sold");
  });

  it("rejects non-numeric event identifiers before a request", async () => {
    const requester = jest.fn();
    const adapter = new EventzillaApiAdapter(requester);
    await expect(
      adapter.getEvent({ apiToken: "token" }, { eventId: "../attendees" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(requester).not.toHaveBeenCalled();
  });
});
