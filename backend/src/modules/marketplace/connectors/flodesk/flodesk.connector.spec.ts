import { MarketplaceConnectorRegistry } from "../connector-registry";
import { FLODESK_CONNECTOR_MANIFEST } from "./flodesk.connector";

describe("Flodesk connector manifest", () => {
  it("registers only two selected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("flodesk")).toBe(FLODESK_CONNECTOR_MANIFEST);
    expect(FLODESK_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "flodesk.getSubscriberSummary",
      "flodesk.getSegmentSummary",
    ]);
    expect(FLODESK_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      FLODESK_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
