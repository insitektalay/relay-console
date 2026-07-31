import { MIXMAX_CONNECTOR_MANIFEST } from "./mixmax.connector";

describe("Mixmax connector manifest", () => {
  it("binds one encrypted developer token, exact sequence ID, and summary read", () => {
    expect(MIXMAX_CONNECTOR_MANIFEST).toMatchObject({ slug: "mixmax", auth: { type: "api_key" } });
    expect(MIXMAX_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["MIXMAX_API_TOKEN", "MIXMAX_SEQUENCE_ID"]);
    expect(MIXMAX_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["mixmax.getSequenceSummary"]);
  });
  it("blocks recipients, messaging, private content, integrations, writes, and raw work in Dangerous", () => {
    const dangerous = MIXMAX_CONNECTOR_MANIFEST.approvalProfiles[1]; expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["mixmax_sequence_mutation", "mixmax_recipient_messaging", "mixmax_private_content", "mixmax_account_integrations", "mixmax_raw_bulk"]));
  });
});
