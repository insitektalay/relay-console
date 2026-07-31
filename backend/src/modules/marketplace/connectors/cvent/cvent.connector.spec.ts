import { MarketplaceConnectorRegistry } from "../connector-registry";
import { CventApiAdapter } from "./cvent-api.adapter";
import { CVENT_CONNECTOR_MANIFEST } from "./cvent.connector";
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const credentials = {
  clientId: "client",
  clientSecret: "secret",
  region: "emea" as const,
};
describe("Cvent Marketplace connector", () => {
  it("registers exact event scope, regional client credentials and two reads", () => {
    expect(new MarketplaceConnectorRegistry().get("cvent")).toBe(
      CVENT_CONNECTOR_MANIFEST,
    );
    expect(
      CVENT_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name),
    ).toEqual(["CVENT_CLIENT_ID", "CVENT_CLIENT_SECRET", "CVENT_REGION"]);
    expect(CVENT_CONNECTOR_MANIFEST.tools).toHaveLength(2);
  });
  it("uses Basic client auth, exact scope and the selected EMEA origin", async () => {
    const calls: Array<{ url: string; headers: Headers; body: string | null }> =
      [];
    const adapter = new CventApiAdapter(async (url, init) => {
      calls.push({
        url: String(url),
        headers: new Headers(init.headers),
        body: typeof init.body === "string" ? init.body : null,
      });
      return String(url).endsWith("/oauth2/token")
        ? response({ access_token: "issued", expires_in: 3600 })
        : response({
            data: [
              {
                id: "event-1",
                title: "Summit",
                attendeeEmail: "hidden@example.com",
              },
            ],
          });
    });
    const result = await adapter.listEvents(credentials, { limit: 7 });
    expect(calls[0].url).toBe(
      "https://api-platform-eur.cvent.com/ea/oauth2/token",
    );
    expect(calls[0].headers.get("authorization")).toMatch(/^Basic /);
    expect(calls[0].body).toContain("scope=event%2Fevents%3Aread");
    expect(calls[1].url).toBe(
      "https://api-platform-eur.cvent.com/ea/events?limit=7",
    );
    expect(JSON.stringify(result)).not.toContain("hidden@example.com");
  });
  it("rejects unsafe event IDs after token exchange and before event fetch", async () => {
    let calls = 0;
    const adapter = new CventApiAdapter(async () => {
      calls += 1;
      return response({ access_token: "issued" });
    });
    await expect(
      adapter.getEvent(credentials, { eventId: "../attendees" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(calls).toBe(1);
  });
});
