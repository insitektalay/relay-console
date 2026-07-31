import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  OMNISEND_CONNECTOR_MANIFEST,
  OMNISEND_SCOPES,
} from "./omnisend.connector";
describe("Omnisend connector manifest", () => {
  it("registers only two selected bounded OAuth reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("omnisend")).toBe(OMNISEND_CONNECTOR_MANIFEST);
    expect(OMNISEND_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "omnisend.getContactSummary",
      "omnisend.getCampaignSummary",
    ]);
    expect(OMNISEND_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual(
      OMNISEND_SCOPES,
    );
    expect(
      OMNISEND_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
