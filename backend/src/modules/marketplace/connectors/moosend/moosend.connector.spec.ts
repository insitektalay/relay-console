import { MarketplaceConnectorRegistry } from "../connector-registry";
import { MOOSEND_CONNECTOR_MANIFEST } from "./moosend.connector";
describe("Moosend connector manifest", () => {
  it("registers only two selected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("moosend")).toBe(MOOSEND_CONNECTOR_MANIFEST);
    expect(MOOSEND_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "moosend.getSubscriberSummary",
      "moosend.getCampaignSummary",
    ]);
    expect(MOOSEND_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      MOOSEND_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
