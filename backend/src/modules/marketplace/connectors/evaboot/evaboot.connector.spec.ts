import { EVABOOT_CONNECTOR_MANIFEST } from "./evaboot.connector";
describe("Evaboot connector manifest", () => {
  it("binds one encrypted token and one quota read", () => {
    expect(EVABOOT_CONNECTOR_MANIFEST).toMatchObject({ slug: "evaboot", auth: { type: "api_key" } });
    expect(EVABOOT_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["EVABOOT_API_TOKEN"]);
    expect(EVABOOT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["evaboot.getQuota"]);
  });
  it("blocks extraction, email data, automation, raw, and bulk work in Dangerous", () => {
    const dangerous = EVABOOT_CONNECTOR_MANIFEST.approvalProfiles[1]; expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["evaboot_extraction", "evaboot_email_data", "evaboot_search_automation", "evaboot_raw_bulk"]));
  });
});
