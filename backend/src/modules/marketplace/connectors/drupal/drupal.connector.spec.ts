import { MarketplaceConnectorRegistry } from "../connector-registry";
import { DRUPAL_CONNECTOR_MANIFEST } from "./drupal.connector";

describe("Drupal connector manifest", () => {
  it("registers only one selected public node lifecycle read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("drupal")).toBe(DRUPAL_CONNECTOR_MANIFEST);
    expect(DRUPAL_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "drupal.getSelectedNodeLifecycle",
    ]);
    expect(
      DRUPAL_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
