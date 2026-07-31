import { MarketplaceConnectorRegistry } from "../connector-registry";
import { SUPABASE_SELF_HOSTED_CONNECTOR_MANIFEST } from "./supabase-self-hosted.connector";

describe("Supabase Self-Hosted connector manifest", () => {
  it("registers only one selected row state read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("supabase-self-hosted")).toBe(
      SUPABASE_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(
      SUPABASE_SELF_HOSTED_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["supabase-self-hosted.getSelectedRowState"]);
    expect(
      SUPABASE_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
