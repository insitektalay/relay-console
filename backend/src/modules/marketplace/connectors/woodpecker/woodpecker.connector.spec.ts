import { WOODPECKER_CONNECTOR_MANIFEST } from "./woodpecker.connector";

describe("Woodpecker connector manifest", () => {
  it("binds one encrypted key, exact campaign ID, and status read", () => {
    expect(WOODPECKER_CONNECTOR_MANIFEST).toMatchObject({ slug: "woodpecker", auth: { type: "api_key" } });
    expect(WOODPECKER_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["WOODPECKER_API_KEY", "WOODPECKER_CAMPAIGN_ID"]);
    expect(WOODPECKER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["woodpecker.getCampaignStatus"]);
  });
  it("blocks messaging, private content, account automation, writes, and raw work in Dangerous", () => {
    const dangerous = WOODPECKER_CONNECTOR_MANIFEST.approvalProfiles[1]; expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["woodpecker_campaign_mutation", "woodpecker_prospect_messaging", "woodpecker_private_content", "woodpecker_account_automation", "woodpecker_raw_bulk"]));
  });
});
