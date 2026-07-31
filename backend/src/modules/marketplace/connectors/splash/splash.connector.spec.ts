import { MarketplaceConnectorRegistry } from "../connector-registry";
import { SplashApiAdapter } from "./splash-api.adapter";
import { SPLASH_CONNECTOR_MANIFEST } from "./splash.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const credentials = {
  clientId: "client",
  clientSecret: "secret",
  username: "api@example.com",
  password: "password",
};

describe("Splash Marketplace connector", () => {
  it("registers customer-owned credentials and only two event reads", () => {
    expect(new MarketplaceConnectorRegistry().get("splash")).toBe(
      SPLASH_CONNECTOR_MANIFEST,
    );
    expect(SPLASH_CONNECTOR_MANIFEST.auth.credentialSchema).toHaveLength(4);
    expect(SPLASH_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "relay_splash_list_events",
      "relay_splash_get_event",
    ]);
  });
  it("uses the documented password token exchange then page one only", async () => {
    const calls: Array<{ url: string; body: string | null; headers: Headers }> =
      [];
    const adapter = new SplashApiAdapter(async (url, init) => {
      calls.push({
        url: String(url),
        body: typeof init.body === "string" ? init.body : null,
        headers: new Headers(init.headers),
      });
      if (String(url).endsWith("/oauth/v2/token"))
        return response({
          access_token: "issued",
          refresh_token: "not-returned",
        });
      return response({
        data: [{ id: 12, title: "Launch", email: "hidden@example.com" }],
      });
    });
    const result = await adapter.listEvents(credentials, { limit: 7 });
    expect(calls[0].body).toContain("grant_type=password");
    expect(calls[1].url).toBe(
      "https://api.splashthat.com/events?limit=7&page=1",
    );
    expect(calls[1].headers.get("authorization")).toBe("Bearer issued");
    expect(JSON.stringify(result)).not.toMatch(
      /hidden@example.com|refresh_token/,
    );
  });
  it("rejects non-numeric event IDs before an event request", async () => {
    let calls = 0;
    const adapter = new SplashApiAdapter(async (url) => {
      calls += 1;
      return String(url).endsWith("/oauth/v2/token")
        ? response({ access_token: "issued" })
        : response({});
    });
    await expect(
      adapter.getEvent(credentials, { eventId: "../contacts" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(calls).toBe(1);
  });
});
