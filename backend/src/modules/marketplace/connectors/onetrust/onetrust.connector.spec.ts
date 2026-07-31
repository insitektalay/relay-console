import { MarketplaceConnectorRegistry } from "../connector-registry";
import { ONETRUST_CONNECTOR_MANIFEST } from "./onetrust.connector";
describe("OneTrust connector manifest", () => {
  it("registers only two selected-domain metadata reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("onetrust")).toBe(ONETRUST_CONNECTOR_MANIFEST);
    expect(ONETRUST_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "onetrust.getDomainBrandingSummary",
      "onetrust.getScanSummary",
    ]);
    expect(
      ONETRUST_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
