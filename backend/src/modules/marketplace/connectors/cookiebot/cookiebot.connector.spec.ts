import { MarketplaceConnectorRegistry } from "../connector-registry";
import { COOKIEBOT_CONNECTOR_MANIFEST } from "./cookiebot.connector";
describe("Cookiebot connector manifest", () => {
  it("registers only two selected-domain aggregate reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("cookiebot")).toBe(COOKIEBOT_CONNECTOR_MANIFEST);
    expect(COOKIEBOT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["cookiebot.getRecentConsentSummary", "cookiebot.getCookieScanSummary"],
    );
    expect(
      COOKIEBOT_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
