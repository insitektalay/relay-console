import { MarketplaceConnectorRegistry } from "../connector-registry";
import { PretixApiAdapter } from "./pretix-api.adapter";
import { PRETIX_CONNECTOR_MANIFEST } from "./pretix.connector";

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("pretix Marketplace connector", () => {
  it("registers an encrypted token, organizer boundary and two event reads", () => {
    expect(new MarketplaceConnectorRegistry().get("pretix")).toBe(
      PRETIX_CONNECTOR_MANIFEST,
    );
    expect(
      PRETIX_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["PRETIX_API_TOKEN", "PRETIX_ORGANIZER"]);
    expect(PRETIX_CONNECTOR_MANIFEST.tools).toHaveLength(2);
  });

  it("pins pretix Hosted, the organizer, page bound and Token auth", async () => {
    let url = "";
    let headers = new Headers();
    const adapter = new PretixApiAdapter(async (requestUrl, init) => {
      url = String(requestUrl);
      headers = new Headers(init.headers);
      return response({
        results: [
          {
            slug: "summit",
            name: { en: "Summit" },
            date_from: "2026-08-01T10:00:00Z",
            meta_data: { private: "hidden" },
          },
        ],
      });
    });
    const result = await adapter.listEvents(
      { apiToken: "secret", organizer: "relay-events" },
      { limit: 7 },
    );
    expect(url).toBe(
      "https://pretix.eu/api/v1/organizers/relay-events/events/?page_size=7",
    );
    expect(headers.get("authorization")).toBe("Token secret");
    expect(result.events[0]).toMatchObject({
      eventId: "summit",
      name: "Summit",
      startsAt: "2026-08-01T10:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("meta_data");
  });

  it("rejects an unsafe organizer before a request", async () => {
    const requester = jest.fn();
    const adapter = new PretixApiAdapter(requester);
    await expect(
      adapter.listEvents({ apiToken: "secret", organizer: "../orders" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(requester).not.toHaveBeenCalled();
  });
});
