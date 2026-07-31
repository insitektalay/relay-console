import { SPOTIO_CONNECTOR_MANIFEST } from "./spotio.connector";

describe("SPOTIO connector manifest", () => {
  it("binds encrypted Admin API keys, one exact data-object ID, and one summary read", () => {
    expect(SPOTIO_CONNECTOR_MANIFEST).toMatchObject({ slug: "spotio", auth: { type: "api_key" } });
    expect(SPOTIO_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["SPOTIO_CLIENT_ID", "SPOTIO_CLIENT_SECRET", "SPOTIO_DATA_OBJECT_ID"]);
    expect(SPOTIO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["spotio.getDataObjectSummary"]);
  });
  it("blocks people, location, content, communications, writes, administration, and raw work in Dangerous", () => {
    const dangerous = SPOTIO_CONNECTOR_MANIFEST.approvalProfiles[1]; expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["spotio_data_object_mutation", "spotio_people_location_content", "spotio_communication", "spotio_account_workflow_admin", "spotio_raw_bulk"]));
  });
});
