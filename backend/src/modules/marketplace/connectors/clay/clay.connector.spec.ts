import { CLAY_CONNECTOR_MANIFEST } from "./clay.connector";
describe("Clay connector manifest", () => {
  it("publishes one encrypted key and one bounded workspace read", () => {
    expect(CLAY_CONNECTOR_MANIFEST).toMatchObject({ slug: "clay", connectorType: "native_clawchat", auth: { type: "api_key" } });
    expect(CLAY_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["CLAY_PUBLIC_API_KEY"]);
    expect(CLAY_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["clay.getWorkspace"]);
  });
  it("gates Safe and preserves credit, private-data, raw, and export blocks in Dangerous", () => {
    const [safe, dangerous] = CLAY_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]); expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(["clay_workspace_get"]);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(["clay_workspace_get"]);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["clay_search_and_enrichment", "clay_private_table_data", "clay_raw_api", "clay_bulk_export"]));
  });
});
