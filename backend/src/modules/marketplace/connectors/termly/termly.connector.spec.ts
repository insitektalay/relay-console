import { MarketplaceConnectorRegistry } from "../connector-registry";
import { TERMLY_CONNECTOR_MANIFEST } from "./termly.connector";

describe("Termly connector manifest", () => {
  it("registers only two selected-website read tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("termly")).toBe(TERMLY_CONNECTOR_MANIFEST);
    expect(TERMLY_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "termly.getWebsiteSummary",
      "termly.getBannerSummary",
    ]);
    expect(
      TERMLY_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
