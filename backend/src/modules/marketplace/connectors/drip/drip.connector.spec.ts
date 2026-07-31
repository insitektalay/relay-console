import { MarketplaceConnectorRegistry } from "../connector-registry";
import { DRIP_CONNECTOR_MANIFEST } from "./drip.connector";

describe("Drip connector manifest", () => {
  it("registers only two selected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("drip")).toBe(DRIP_CONNECTOR_MANIFEST);
    expect(DRIP_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "drip.getSubscriberSummary",
      "drip.getCampaignSummary",
    ]);
    expect(DRIP_CONNECTOR_MANIFEST.auth.type).toBe("oauth2_authorization_code");
    expect(
      DRIP_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
