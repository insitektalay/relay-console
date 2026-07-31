import { MarketplaceConnectorRegistry } from "../connector-registry";
import { AWEBER_CONNECTOR_MANIFEST, AWEBER_SCOPES } from "./aweber.connector";

describe("AWeber connector manifest", () => {
  it("registers only two selected bounded OAuth reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("aweber")).toBe(AWEBER_CONNECTOR_MANIFEST);
    expect(AWEBER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "aweber.getSubscriberSummary",
      "aweber.getCampaignSummary",
    ]);
    expect(AWEBER_CONNECTOR_MANIFEST.auth.type).toBe(
      "oauth2_authorization_code",
    );
    expect(AWEBER_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual(
      AWEBER_SCOPES,
    );
    expect(
      AWEBER_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
