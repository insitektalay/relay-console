import { MarketplaceConnectorRegistry } from "../connector-registry";
import { TODOIST_CONNECTOR_MANIFEST } from "./todoist.connector";

describe("Todoist Marketplace connector", () => {
  it("registers the Relay-owned rotating-token OAuth contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("todoist")).toBe(TODOIST_CONNECTOR_MANIFEST);
    expect(TODOIST_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://app.todoist.com/oauth/authorize",
      tokenUrl: "https://api.todoist.com/oauth/access_token",
      requiredScopes: [
        "data:read_write",
        "data:delete",
        "project:delete",
        "backups:read",
      ],
      pkce: false,
      supportsRefresh: true,
    });
  });

  it("keeps bounded reads direct and the full API behind Safe approval", () => {
    expect(TODOIST_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      TODOIST_CONNECTOR_MANIFEST.tools.filter(
        (tool) => tool.approvalRequired,
      ),
    ).toHaveLength(1);
    expect(
      TODOIST_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["todoist_safe", "dangerously_skip_permissions"]);
    expect(
      TODOIST_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual(["todoist_full_api"]);
  });
});
