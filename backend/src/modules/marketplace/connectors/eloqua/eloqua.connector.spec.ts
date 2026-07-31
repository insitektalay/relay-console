import { MarketplaceConnectorRegistry } from "../connector-registry";
import { ELOQUA_CONNECTOR_MANIFEST } from "./eloqua.connector";

describe("Eloqua connector", () => {
  it("registers exactly two selected-resource reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("eloqua");
    expect(manifest).toBe(ELOQUA_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "eloqua.getContactSummary",
      "eloqua.getCampaignSummary",
    ]);
    expect(manifest?.auth.type).toBe("custom");
    expect(manifest?.approvalProfiles[0].approvalRequiredActions).toEqual([]);
    expect(
      manifest?.approvalProfiles[0].blockedActions.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "eloqua_private_data",
        "eloqua_mutation",
        "eloqua_broad_access",
      ]),
    );
  });
});
