import { ONTRAPORT_CONNECTOR_MANIFEST } from "./ontraport.connector";
import {
  ONTRAPORT_MANAGE_TOOLS,
  ONTRAPORT_READ_TOOLS,
} from "./ontraport-mcp.adapter";

describe("Ontraport connector manifest", () => {
  it("publishes the fixed hosted-MCP credential and policy contract", () => {
    expect(ONTRAPORT_CONNECTOR_MANIFEST).toMatchObject({
      slug: "ontraport",
      connectorType: "mcp_backed",
      auth: { type: "api_key" },
    });
    expect(
      ONTRAPORT_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["ONTRAPORT_APP_ID", "ONTRAPORT_API_KEY"]);
    expect(
      JSON.stringify(ONTRAPORT_CONNECTOR_MANIFEST.tools[0].inputSchema),
    ).toContain(ONTRAPORT_READ_TOOLS[0]);
    expect(
      JSON.stringify(ONTRAPORT_CONNECTOR_MANIFEST.tools[1].inputSchema),
    ).toContain(ONTRAPORT_MANAGE_TOOLS[0]);
  });

  it("requires Safe approval for every provider mutation and removes only Relay approval in Dangerous mode", () => {
    const [safe, dangerous] = ONTRAPORT_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions.map((item) => item.id)).toEqual([
      "ontraport_mcp_read",
    ]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual([
      "ontraport_mcp_manage",
    ]);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual([
      "ontraport_mcp_read",
      "ontraport_mcp_manage",
    ]);
    expect(dangerous.approvalRequiredActions).toEqual([]);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "ontraport_raw_mcp",
        "ontraport_secret_exposure",
      ]),
    );
  });
});
