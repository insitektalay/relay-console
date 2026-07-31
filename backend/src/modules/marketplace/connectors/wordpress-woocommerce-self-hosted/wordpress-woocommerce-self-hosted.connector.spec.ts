import { MarketplaceConnectorRegistry } from "../connector-registry";
import { WORDPRESS_WOOCOMMERCE_SELF_HOSTED_CONNECTOR_MANIFEST } from "./wordpress-woocommerce-self-hosted.connector";

describe("WordPress WooCommerce Self-Hosted connector manifest", () => {
  it("registers only one selected public product read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("wordpress-woocommerce-self-hosted")).toBe(
      WORDPRESS_WOOCOMMERCE_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(
      WORDPRESS_WOOCOMMERCE_SELF_HOSTED_CONNECTOR_MANIFEST.tools.map(
        (tool) => tool.name,
      ),
    ).toEqual([
      "wordpress-woocommerce-self-hosted.getSelectedProductAvailability",
    ]);
    expect(
      WORDPRESS_WOOCOMMERCE_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
