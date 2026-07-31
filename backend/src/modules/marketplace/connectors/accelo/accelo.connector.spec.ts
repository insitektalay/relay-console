import { MarketplaceConnectorRegistry } from "../connector-registry";
import { ACCELO_CONNECTOR_MANIFEST } from "./accelo.connector";

describe("Accelo connector manifest", () => {
  it("registers only one no-input selected-project state read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("accelo")).toBe(ACCELO_CONNECTOR_MANIFEST);
    expect(ACCELO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "accelo.getSelectedProjectState",
    ]);
    expect(
      ACCELO_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
