import { MarketplaceConnectorRegistry } from "../connector-registry";
import { STATAMIC_CONNECTOR_MANIFEST } from "./statamic.connector";

describe("Statamic connector manifest", () => {
  it("registers only one selected entry state read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("statamic")).toBe(STATAMIC_CONNECTOR_MANIFEST);
    expect(STATAMIC_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "statamic.getSelectedEntryState",
    ]);
    expect(
      STATAMIC_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
