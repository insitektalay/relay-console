import { MarketplaceConnectorRegistry } from "../connector-registry";
import { HOMEBREW_CONNECTOR_MANIFEST } from "./homebrew.connector";

describe("Homebrew connector manifest", () => {
  it("registers only two selected bounded public reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("homebrew")).toBe(HOMEBREW_CONNECTOR_MANIFEST);
    expect(HOMEBREW_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "homebrew.getFormulaSummary",
      "homebrew.getCaskSummary",
    ]);
    expect(HOMEBREW_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      HOMEBREW_CONNECTOR_MANIFEST.auth.credentialSchema.every(
        (field) => field.secret === false,
      ),
    ).toBe(true);
    expect(
      HOMEBREW_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
