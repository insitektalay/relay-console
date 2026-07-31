import { MarketplaceConnectorRegistry } from "../connector-registry";
import { GETRESPONSE_CONNECTOR_MANIFEST } from "./getresponse.connector";
describe("GetResponse connector manifest", () => {
  it("registers only two selected bounded OAuth reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("getresponse")).toBe(GETRESPONSE_CONNECTOR_MANIFEST);
    expect(
      GETRESPONSE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "getresponse.getContactSummary",
      "getresponse.getNewsletterSummary",
    ]);
    expect(GETRESPONSE_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual(
      [],
    );
    expect(
      GETRESPONSE_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
