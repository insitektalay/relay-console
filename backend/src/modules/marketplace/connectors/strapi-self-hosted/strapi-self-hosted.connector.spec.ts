import { MarketplaceConnectorRegistry } from "../connector-registry";
import { STRAPI_SELF_HOSTED_CONNECTOR_MANIFEST } from "./strapi-self-hosted.connector";

describe("Strapi Self-Hosted connector manifest", () => {
  it("registers only one selected document lifecycle read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("strapi-self-hosted")).toBe(
      STRAPI_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(
      STRAPI_SELF_HOSTED_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["strapi-self-hosted.getSelectedDocumentLifecycle"]);
    expect(
      STRAPI_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
