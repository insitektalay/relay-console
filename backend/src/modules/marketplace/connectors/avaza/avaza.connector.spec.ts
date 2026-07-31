import { MarketplaceConnectorRegistry } from "../connector-registry";
import { AVAZA_CONNECTOR_MANIFEST } from "./avaza.connector";

describe("Avaza connector manifest", () => {
  it("registers only one no-input selected-project state read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("avaza")).toBe(AVAZA_CONNECTOR_MANIFEST);
    expect(AVAZA_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "avaza.getSelectedProjectState",
    ]);
    expect(
      AVAZA_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
