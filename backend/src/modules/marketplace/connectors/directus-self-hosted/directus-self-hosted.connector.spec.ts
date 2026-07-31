import { MarketplaceConnectorRegistry } from "../connector-registry";
import { DIRECTUS_SELF_HOSTED_CONNECTOR_MANIFEST } from "./directus-self-hosted.connector";

describe("Directus Self-Hosted connector manifest", () => {
  it("registers only one selected item state read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("directus-self-hosted")).toBe(
      DIRECTUS_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(
      DIRECTUS_SELF_HOSTED_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["directus-self-hosted.getSelectedItemState"]);
    expect(
      DIRECTUS_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
