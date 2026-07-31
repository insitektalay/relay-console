import { PHANTOMBUSTER_CONNECTOR_MANIFEST } from "./phantombuster.connector";
describe("PhantomBuster connector manifest", () => {
  it("binds one encrypted key, exact Agent ID, and status read", () => {
    expect(PHANTOMBUSTER_CONNECTOR_MANIFEST).toMatchObject({ slug: "phantombuster", auth: { type: "api_key" } });
    expect(PHANTOMBUSTER_CONNECTOR_MANIFEST.auth.credentialSchema.map((f) => f.name)).toEqual(["PHANTOMBUSTER_API_KEY", "PHANTOMBUSTER_AGENT_ID"]);
    expect(PHANTOMBUSTER_CONNECTOR_MANIFEST.tools.map((t) => t.name)).toEqual(["phantombuster.getAgentStatus"]);
  });
  it("blocks launches, outputs, mutation, raw calls, and exports in Dangerous", () => {
    const dangerous = PHANTOMBUSTER_CONNECTOR_MANIFEST.approvalProfiles[1];
    expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((x) => x.id)).toEqual(expect.arrayContaining(["phantombuster_agent_run", "phantombuster_private_output", "phantombuster_raw_api", "phantombuster_bulk_export"]));
  });
});
