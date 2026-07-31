import { MarketplaceConnectorRegistry } from "../connector-registry";
import { KIRBY_CMS_CONNECTOR_MANIFEST } from "./kirby-cms.connector";

describe("Kirby CMS connector manifest", () => {
  it("registers only one selected page state read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("kirby-cms")).toBe(KIRBY_CMS_CONNECTOR_MANIFEST);
    expect(KIRBY_CMS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["kirby-cms.getSelectedPageState"],
    );
    expect(
      KIRBY_CMS_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
