import { MarketplaceConnectorRegistry } from "../connector-registry";
import { HumanitixApiAdapter } from "./humanitix-api.adapter";
import { HUMANITIX_CONNECTOR_MANIFEST } from "./humanitix.connector";

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Humanitix Marketplace connector", () => {
  it("registers one encrypted key and two bounded event reads", () => {
    expect(new MarketplaceConnectorRegistry().get("humanitix")).toBe(
      HUMANITIX_CONNECTOR_MANIFEST,
    );
    expect(
      HUMANITIX_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["HUMANITIX_API_KEY"]);
    expect(HUMANITIX_CONNECTOR_MANIFEST.tools).toHaveLength(2);
  });
  it("pins page one, requested bound and x-api-key auth", async () => {
    let url = "";
    let headers = new Headers();
    const adapter = new HumanitixApiAdapter(async (requestUrl, init) => {
      url = String(requestUrl);
      headers = new Headers(init.headers);
      return response({
        events: [
          {
            _id: "5ac598ccd8fe7c0c0f212e2a",
            name: "Summit",
            published: true,
            additionalQuestions: [{ answer: "hidden" }],
            pricing: { maximumPrice: 20 },
          },
        ],
      });
    });
    const result = await adapter.listEvents(
      { apiToken: "token" },
      { limit: 7 },
    );
    expect(url).toBe("https://api.humanitix.com/v1/events?page=1&pageSize=7");
    expect(headers.get("x-api-key")).toBe("token");
    expect(JSON.stringify(result)).not.toContain("additionalQuestions");
    expect(JSON.stringify(result)).not.toContain("maximumPrice");
  });
  it("rejects unsafe identifiers before a request", async () => {
    const requester = jest.fn();
    const adapter = new HumanitixApiAdapter(requester);
    await expect(
      adapter.getEvent({ apiToken: "token" }, { eventId: "../orders" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(requester).not.toHaveBeenCalled();
  });
});
