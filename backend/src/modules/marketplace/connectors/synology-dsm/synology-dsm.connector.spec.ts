import { MarketplaceConnectorRegistry } from "../connector-registry";
import { SYNOLOGY_DSM_CONNECTOR_MANIFEST } from "./synology-dsm.connector";

describe("Synology DSM connector manifest", () => {
  it("registers only one selected unauthenticated compatibility read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("synology-dsm")).toBe(SYNOLOGY_DSM_CONNECTOR_MANIFEST);
    expect(
      SYNOLOGY_DSM_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["synology-dsm.getSelectedApiCompatibility"]);
    expect(SYNOLOGY_DSM_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      SYNOLOGY_DSM_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
