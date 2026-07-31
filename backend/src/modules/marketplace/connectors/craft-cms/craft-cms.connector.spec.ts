import { MarketplaceConnectorRegistry } from "../connector-registry";
import { CRAFT_CMS_CONNECTOR_MANIFEST } from "./craft-cms.connector";

describe("Craft CMS connector manifest", () => {
  it("registers only one selected entry lifecycle read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("craft-cms")).toBe(CRAFT_CMS_CONNECTOR_MANIFEST);
    expect(CRAFT_CMS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["craft-cms.getSelectedEntryLifecycle"],
    );
    expect(
      CRAFT_CMS_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
