import { MarketplaceConnectorRegistry } from "../connector-registry";
import { EMMA_CONNECTOR_MANIFEST } from "./emma.connector";

describe("Emma connector manifest", () => {
  it("registers only two selected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("emma")).toBe(EMMA_CONNECTOR_MANIFEST);
    expect(EMMA_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "emma.getMemberSummary",
      "emma.getMailingSummary",
    ]);
    expect(EMMA_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      EMMA_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
