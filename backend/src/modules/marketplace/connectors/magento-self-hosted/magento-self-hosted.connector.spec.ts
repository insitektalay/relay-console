import { MarketplaceConnectorRegistry } from "../connector-registry";
import { MAGENTO_SELF_HOSTED_CONNECTOR_MANIFEST } from "./magento-self-hosted.connector";

describe("Magento Self-Hosted connector manifest", () => {
  it("registers only one selected public product stock read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("magento-self-hosted")).toBe(
      MAGENTO_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(
      MAGENTO_SELF_HOSTED_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["magento-self-hosted.getSelectedProductStock"]);
    expect(
      MAGENTO_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
