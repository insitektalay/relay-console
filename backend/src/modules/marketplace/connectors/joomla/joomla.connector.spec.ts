import { MarketplaceConnectorRegistry } from "../connector-registry";
import { JOOMLA_CONNECTOR_MANIFEST } from "./joomla.connector";

describe("Joomla connector manifest", () => {
  it("registers only one selected article lifecycle read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("joomla")).toBe(JOOMLA_CONNECTOR_MANIFEST);
    expect(JOOMLA_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "joomla.getSelectedArticleLifecycle",
    ]);
    expect(
      JOOMLA_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
