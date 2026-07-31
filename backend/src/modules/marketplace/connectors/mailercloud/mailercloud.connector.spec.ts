import { MarketplaceConnectorRegistry } from "../connector-registry";
import { MAILERCLOUD_CONNECTOR_MANIFEST } from "./mailercloud.connector";
describe("Mailercloud connector manifest", () => {
  it("registers only two selected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("mailercloud")).toBe(MAILERCLOUD_CONNECTOR_MANIFEST);
    expect(
      MAILERCLOUD_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "mailercloud.getContactSummary",
      "mailercloud.getCampaignSummary",
    ]);
    expect(MAILERCLOUD_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      MAILERCLOUD_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
