import { MarketplaceConnectorRegistry } from "../connector-registry";
import { SALESFORCE_MARKETING_CLOUD_CONNECTOR_MANIFEST } from "./salesforce-marketing-cloud.connector";

describe("Salesforce Marketing Cloud connector manifest", () => {
  it("registers only two zero-scope platform validation reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("salesforce-marketing-cloud")).toBe(
      SALESFORCE_MARKETING_CLOUD_CONNECTOR_MANIFEST,
    );
    expect(
      SALESFORCE_MARKETING_CLOUD_CONNECTOR_MANIFEST.tools.map(
        (tool) => tool.name,
      ),
    ).toEqual([
      "salesforce-marketing-cloud.getBusinessUnitContext",
      "salesforce-marketing-cloud.getEndpointSummary",
    ]);
    expect(
      SALESFORCE_MARKETING_CLOUD_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
