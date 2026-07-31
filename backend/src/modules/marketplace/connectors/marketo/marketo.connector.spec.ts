import { MarketplaceConnectorRegistry } from "../connector-registry";
import { MARKETO_CONNECTOR_MANIFEST } from "./marketo.connector";

describe("Marketo connector manifest", () => {
  it("registers only two preselected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("marketo")).toBe(MARKETO_CONNECTOR_MANIFEST);
    expect(MARKETO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "marketo.getLeadSummary",
      "marketo.getProgramSummary",
    ]);
    expect(
      MARKETO_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
