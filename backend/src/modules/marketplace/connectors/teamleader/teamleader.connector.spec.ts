import {
  TEAMLEADER_CONNECTOR_MANIFEST,
  TEAMLEADER_SCOPES,
} from "./teamleader.connector";

describe("Teamleader connector manifest", () => {
  it("publishes Relay-owned OAuth with only the deals scope and three reads", () => {
    expect(TEAMLEADER_CONNECTOR_MANIFEST).toMatchObject({
      slug: "teamleader",
      connectorType: "native_clawchat",
      auth: {
        type: "oauth2_authorization_code",
        oauth: {
          authorizationUrl: "https://focus.teamleader.eu/oauth2/authorize",
          tokenUrl: "https://focus.teamleader.eu/oauth2/access_token",
          refreshUrl: "https://focus.teamleader.eu/oauth2/access_token",
          requiredScopes: ["deals"],
          pkce: false,
          supportsRefresh: true,
        },
      },
    });
    expect(TEAMLEADER_SCOPES).toEqual(["deals"]);
    expect(
      TEAMLEADER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "teamleader.getCurrentUser",
      "teamleader.listDeals",
      "teamleader.getDeal",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = TEAMLEADER_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = [
      "teamleader_user_get",
      "teamleader_deal_list",
      "teamleader_deal_get",
    ];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "teamleader_record_mutation",
        "teamleader_private_crm",
        "teamleader_raw_api",
        "teamleader_bulk_export",
      ]),
    );
  });
});
