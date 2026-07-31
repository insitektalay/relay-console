import { MarketplaceConnectorRegistry } from "../connector-registry";
import { KANTATA_OX_CONNECTOR_MANIFEST } from "./kantata-ox.connector";

describe("Kantata OX connector manifest", () => {
  it("registers only one no-input selected-project state read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("kantata-ox")).toBe(KANTATA_OX_CONNECTOR_MANIFEST);
    expect(
      KANTATA_OX_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["kantataOx.getSelectedWorkspaceState"]);
    expect(
      KANTATA_OX_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
