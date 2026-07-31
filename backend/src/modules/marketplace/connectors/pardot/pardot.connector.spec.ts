import { MarketplaceConnectorRegistry } from "../connector-registry";
import { PARDOT_CONNECTOR_MANIFEST } from "./pardot.connector";

describe("Pardot connector manifest", () => {
  it("registers only two selected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("pardot")).toBe(PARDOT_CONNECTOR_MANIFEST);
    expect(PARDOT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "pardot.getProspectSummary",
      "pardot.getCampaignSummary",
    ]);
    expect(
      PARDOT_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
