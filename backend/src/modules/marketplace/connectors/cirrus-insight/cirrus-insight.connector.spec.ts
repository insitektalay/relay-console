import { CIRRUS_INSIGHT_CONNECTOR_MANIFEST } from "./cirrus-insight.connector";

describe("Cirrus Insight connector manifest", () => {
  it("binds encrypted organization and user identifiers to one scheduling-link read", () => {
    expect(CIRRUS_INSIGHT_CONNECTOR_MANIFEST).toMatchObject({ slug: "cirrus-insight", auth: { type: "custom" } });
    expect(CIRRUS_INSIGHT_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["CIRRUS_INSIGHT_ORGANIZATION_ID", "CIRRUS_INSIGHT_USER_EMAIL"]);
    expect(CIRRUS_INSIGHT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["cirrusInsight.getSchedulingLinks"]);
  });
  it("blocks meetings, people, calendars, webhooks, administration, and raw work in Dangerous", () => {
    const dangerous = CIRRUS_INSIGHT_CONNECTOR_MANIFEST.approvalProfiles[1]; expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["cirrus_insight_meeting_mutation", "cirrus_insight_people_content", "cirrus_insight_private_calendar", "cirrus_insight_org_webhook_admin", "cirrus_insight_raw_bulk"]));
  });
});
