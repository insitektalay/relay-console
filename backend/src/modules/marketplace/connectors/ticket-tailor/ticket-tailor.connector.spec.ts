import { MarketplaceConnectorRegistry } from "../connector-registry";
import { TicketTailorApiAdapter } from "./ticket-tailor-api.adapter";
import { TICKET_TAILOR_CONNECTOR_MANIFEST } from "./ticket-tailor.connector";

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Ticket Tailor Marketplace connector", () => {
  it("registers an encrypted, events-only key and two bounded reads", () => {
    expect(new MarketplaceConnectorRegistry().get("ticket-tailor")).toBe(
      TICKET_TAILOR_CONNECTOR_MANIFEST,
    );
    expect(
      TICKET_TAILOR_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["TICKET_TAILOR_API_KEY"]);
    expect(TICKET_TAILOR_CONNECTOR_MANIFEST.tools).toHaveLength(2);
  });

  it("pins the first cursor page, requested bound and documented Basic auth", async () => {
    let url = "";
    let headers = new Headers();
    const adapter = new TicketTailorApiAdapter(async (requestUrl, init) => {
      url = String(requestUrl);
      headers = new Headers(init.headers);
      return response({
        data: [
          {
            id: "ev_123",
            name: "Summit",
            status: "published",
            access_code: "hidden",
            total_orders: 42,
          },
        ],
      });
    });
    const result = await adapter.listEvents(
      { apiToken: "sk_example" },
      { limit: 7 },
    );
    expect(url).toBe("https://api.tickettailor.com/v1/events?limit=7");
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("sk_example").toString("base64")}`,
    );
    expect(JSON.stringify(result)).not.toContain("access_code");
    expect(JSON.stringify(result)).not.toContain("total_orders");
  });

  it("rejects unsafe event identifiers before a request", async () => {
    const requester = jest.fn();
    const adapter = new TicketTailorApiAdapter(requester);
    await expect(
      adapter.getEvent({ apiToken: "token" }, { eventId: "../orders" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(requester).not.toHaveBeenCalled();
  });
});
