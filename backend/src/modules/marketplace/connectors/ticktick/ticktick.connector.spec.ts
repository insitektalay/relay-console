import { MarketplaceConnectorRegistry } from "../connector-registry";
import { TICKTICK_CONNECTOR_MANIFEST } from "./ticktick.connector";

describe("TickTick Marketplace connector", () => {
  it("registers the documented access-token-only OAuth contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("ticktick")).toBe(TICKTICK_CONNECTOR_MANIFEST);
    expect(TICKTICK_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://ticktick.com/oauth/authorize",
      tokenUrl: "https://ticktick.com/oauth/token",
      requiredScopes: ["tasks:read", "tasks:write"],
      pkce: false,
      supportsRefresh: false,
    });
  });

  it("keeps bounded reads direct and the full API behind Safe approval", () => {
    expect(TICKTICK_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      TICKTICK_CONNECTOR_MANIFEST.tools.filter((tool) => tool.approvalRequired),
    ).toHaveLength(1);
    expect(
      TICKTICK_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["ticktick_full_api"]);
  });
});
