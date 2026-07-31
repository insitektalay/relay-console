import { CLAYGENT_CONNECTOR_MANIFEST } from "./claygent.connector";
describe("Claygent connector manifest", () => {
  it("publishes one encrypted key and one workspace-binding read", () => {
    expect(CLAYGENT_CONNECTOR_MANIFEST).toMatchObject({ slug: "claygent", auth: { type: "api_key" } });
    expect(CLAYGENT_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["CLAYGENT_PUBLIC_API_KEY"]);
    expect(CLAYGENT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["claygent.getWorkspace"]);
  });
  it("hard-blocks execution and unstable/private surfaces in both profiles", () => {
    const [safe, dangerous] = CLAYGENT_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.approvalRequiredActions).toHaveLength(1); expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["claygent_run", "claygent_private_configuration", "claygent_raw_surface", "claygent_bulk_export"]));
  });
});
