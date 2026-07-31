import { MarketplaceConnectorRegistry } from "../connector-registry";
import { PROOF_CONNECTOR_MANIFEST } from "./proof.connector";

describe("Proof connector manifest", () => {
  it("registers only the bounded read-only transaction tools", () => {
    const registry = new MarketplaceConnectorRegistry();

    expect(registry.get("proof")).toBe(PROOF_CONNECTOR_MANIFEST);
    expect(PROOF_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "proof.listTransactions",
      "proof.getTransaction",
    ]);
    expect(
      PROOF_CONNECTOR_MANIFEST.approvalProfiles
        .find((profile) => profile.id === "proof_read_only")
        ?.allowedActions.map((action) => action.id),
    ).toEqual(["proof_transaction_list", "proof_transaction_get"]);
    expect(
      PROOF_CONNECTOR_MANIFEST.tools.every((tool) => tool.action === "read"),
    ).toBe(true);
  });
});
