import { LEMLIST_CONNECTOR_MANIFEST } from "./lemlist.connector";

describe("lemlist connector manifest", () => {
  it("binds one encrypted key, exact campaign ID, and status read", () => {
    expect(LEMLIST_CONNECTOR_MANIFEST).toMatchObject({ slug: "lemlist", auth: { type: "api_key" } });
    expect(LEMLIST_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["LEMLIST_API_KEY", "LEMLIST_CAMPAIGN_ID"]);
    expect(LEMLIST_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["lemlist.getCampaignStatus"]);
  });
  it("blocks messaging, enrichment, private account data, writes, and raw work in Dangerous", () => {
    const dangerous = LEMLIST_CONNECTOR_MANIFEST.approvalProfiles[1]; expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["lemlist_campaign_mutation", "lemlist_people_messaging", "lemlist_enrichment_ai", "lemlist_private_account", "lemlist_raw_bulk"]));
  });
});
