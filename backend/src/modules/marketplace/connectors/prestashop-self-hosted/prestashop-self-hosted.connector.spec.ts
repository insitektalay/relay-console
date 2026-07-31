import { MarketplaceConnectorRegistry } from "../connector-registry";
import { PRESTASHOP_SELF_HOSTED_CONNECTOR_MANIFEST } from "./prestashop-self-hosted.connector";

describe("PrestaShop Self-Hosted connector manifest", () => {
  it("registers only one selected product availability read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("prestashop-self-hosted")).toBe(
      PRESTASHOP_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(
      PRESTASHOP_SELF_HOSTED_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["prestashop-self-hosted.getSelectedProductAvailability"]);
    expect(
      PRESTASHOP_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
