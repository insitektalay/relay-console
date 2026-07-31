import { MarketplaceConnectorRegistry } from "../connector-registry";
import { SALESFORCE_COMMERCE_CLOUD_CONNECTOR_MANIFEST } from "./salesforce-commerce-cloud.connector";

describe("Salesforce Commerce Cloud connector manifest", () => {
  it("registers only two preselected public storefront reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("salesforce-commerce-cloud")).toBe(
      SALESFORCE_COMMERCE_CLOUD_CONNECTOR_MANIFEST,
    );
    expect(
      SALESFORCE_COMMERCE_CLOUD_CONNECTOR_MANIFEST.tools.map(
        (tool) => tool.name,
      ),
    ).toEqual([
      "salesforce-commerce-cloud.getProductSummary",
      "salesforce-commerce-cloud.getCategorySummary",
    ]);
    expect(
      SALESFORCE_COMMERCE_CLOUD_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
