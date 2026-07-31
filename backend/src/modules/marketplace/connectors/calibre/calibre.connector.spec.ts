import { MarketplaceConnectorRegistry } from "../connector-registry";
import { CALIBRE_CONNECTOR_MANIFEST } from "./calibre.connector";

describe("Calibre connector manifest", () => {
  it("registers only one selected bounded read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("calibre")).toBe(CALIBRE_CONNECTOR_MANIFEST);
    expect(CALIBRE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "calibre.getSelectedBookLifecycle",
    ]);
    expect(CALIBRE_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      CALIBRE_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
