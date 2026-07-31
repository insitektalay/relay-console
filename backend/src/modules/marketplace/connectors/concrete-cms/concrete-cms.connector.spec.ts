import { MarketplaceConnectorRegistry } from "../connector-registry";
import { CONCRETE_CMS_CONNECTOR_MANIFEST } from "./concrete-cms.connector";

describe("Concrete CMS connector manifest", () => {
  it("registers only one selected page lifecycle read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("concrete-cms")).toBe(CONCRETE_CMS_CONNECTOR_MANIFEST);
    expect(
      CONCRETE_CMS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["concrete-cms.getSelectedPageLifecycle"]);
    expect(
      CONCRETE_CMS_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
