import { MarketplaceConnectorRegistry } from "../connector-registry";
import { SessionizeApiAdapter } from "./sessionize-api.adapter";
import { SESSIONIZE_CONNECTOR_MANIFEST } from "./sessionize.connector";
const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
describe("Sessionize Marketplace connector", () => {
  it("registers one encrypted endpoint ID and two bounded reads", () => {
    expect(new MarketplaceConnectorRegistry().get("sessionize")).toBe(
      SESSIONIZE_CONNECTOR_MANIFEST,
    );
    expect(SESSIONIZE_CONNECTOR_MANIFEST.tools).toHaveLength(2);
  });
  it("pins the Sessions view and strips custom data", async () => {
    let url = "";
    const adapter = new SessionizeApiAdapter(async (requestUrl) => {
      url = String(requestUrl);
      return response([
        {
          sessions: [
            {
              id: "14022",
              title: "Keynote",
              startsAt: "2026-09-01T09:00:00Z",
              speakers: [{ name: "Ada" }],
              questionAnswers: [{ answer: "hidden" }],
              recordingUrl: "https://private.example",
            },
          ],
        },
      ]);
    });
    const result = await adapter.listSessions(
      { endpointId: "jl4ktls0" },
      { limit: 7 },
    );
    expect(url).toBe("https://sessionize.com/api/v2/jl4ktls0/view/Sessions");
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].speakers).toEqual(["Ada"]);
    expect(JSON.stringify(result)).not.toContain("questionAnswers");
    expect(JSON.stringify(result)).not.toContain("recordingUrl");
  });
  it("rejects unsafe endpoint IDs before a request", async () => {
    const requester = jest.fn();
    const adapter = new SessionizeApiAdapter(requester);
    await expect(
      adapter.listSessions({ endpointId: "../private" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    expect(requester).not.toHaveBeenCalled();
  });
});
