import { MarketplaceConnectorRegistry } from "../connector-registry";
import { AirmeetApiAdapter } from "./airmeet-api.adapter";
import { AIRMEET_CONNECTOR_MANIFEST } from "./airmeet.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const credentials = {
  accessKey: "access",
  secretKey: "secret",
  region: "eu" as const,
};

describe("Airmeet Marketplace connector", () => {
  it("registers the customer-owned key pair, region and two bounded reads", () => {
    expect(new MarketplaceConnectorRegistry().get("airmeet")).toBe(
      AIRMEET_CONNECTOR_MANIFEST,
    );
    expect(
      AIRMEET_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["AIRMEET_ACCESS_KEY", "AIRMEET_SECRET_KEY", "AIRMEET_REGION"]);
    expect(AIRMEET_CONNECTOR_MANIFEST.tools).toHaveLength(2);
  });

  it("exchanges keys only at the selected region and lists one bounded page", async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const adapter = new AirmeetApiAdapter(async (url, init) => {
      calls.push({ url: String(url), headers: new Headers(init.headers) });
      if (String(url).endsWith("/auth"))
        return response({ success: true, data: { token: "issued" } });
      return response({
        data: [
          {
            uid: "event_1",
            name: "Launch",
            status: "CREATED",
            hostEmail: "hidden@example.com",
          },
        ],
      });
    });
    const result = await adapter.listEvents(credentials, { limit: 7 });
    expect(calls.map((call) => call.url)).toEqual([
      "https://api-gateway-prod.eu.airmeet.com/prod/auth",
      "https://api-gateway-prod.eu.airmeet.com/prod/airmeets?size=7",
    ]);
    expect(calls[1].headers.get("x-airmeet-access-token")).toBe("issued");
    expect(JSON.stringify(result)).not.toContain("hidden@example.com");
  });

  it("strips host and speaker identity from session summaries", async () => {
    const adapter = new AirmeetApiAdapter(async (url) =>
      String(url).endsWith("/auth")
        ? response({ success: true, data: { token: "issued" } })
        : response({
            sessions: [
              {
                sessionid: "session_1",
                name: "Keynote",
                host_id: ["host"],
                speakerList: [{ email: "hidden@example.com" }],
              },
            ],
          }),
    );
    const result = await adapter.listSessions(credentials, {
      eventId: "event_1",
      limit: 3,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /host|speaker|hidden@example.com/,
    );
  });
});
