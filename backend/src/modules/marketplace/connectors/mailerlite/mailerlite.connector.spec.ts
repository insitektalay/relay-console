import { MarketplaceConnectorRegistry } from "../connector-registry";
import { MAILERLITE_CONNECTOR_MANIFEST } from "./mailerlite.connector";

describe("MailerLite connector manifest", () => {
  it("registers only two selected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("mailerlite")).toBe(MAILERLITE_CONNECTOR_MANIFEST);
    expect(
      MAILERLITE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "mailerlite.getSubscriberSummary",
      "mailerlite.getCampaignSummary",
    ]);
    expect(MAILERLITE_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      MAILERLITE_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
