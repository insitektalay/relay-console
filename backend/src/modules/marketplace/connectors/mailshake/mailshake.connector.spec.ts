import { MAILSHAKE_CONNECTOR_MANIFEST } from "./mailshake.connector";

describe("Mailshake connector manifest", () => {
  it("binds one encrypted key, exact campaign ID, and status read", () => {
    expect(MAILSHAKE_CONNECTOR_MANIFEST).toMatchObject({ slug: "mailshake", auth: { type: "api_key" } });
    expect(MAILSHAKE_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["MAILSHAKE_API_KEY", "MAILSHAKE_CAMPAIGN_ID"]);
    expect(MAILSHAKE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["mailshake.getCampaignStatus"]);
  });
  it("blocks messaging, content, team automation, writes, and raw work in Dangerous", () => {
    const dangerous = MAILSHAKE_CONNECTOR_MANIFEST.approvalProfiles[1]; expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["mailshake_campaign_mutation", "mailshake_people_messaging", "mailshake_private_content", "mailshake_team_automation", "mailshake_raw_bulk"]));
  });
});
