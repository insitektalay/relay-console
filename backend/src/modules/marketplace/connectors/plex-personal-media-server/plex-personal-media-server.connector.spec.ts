import { MarketplaceConnectorRegistry } from "../connector-registry";
import { PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST } from "./plex-personal-media-server.connector";

describe("Plex Personal Media Server connector manifest", () => {
  it("registers only one selected bounded read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("plex-personal-media-server")).toBe(
      PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST,
    );
    expect(
      PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST.tools.map(
        (tool) => tool.name,
      ),
    ).toEqual(["plex-personal-media-server.getSelectedItemLifecycle"]);
    expect(PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST.auth.type).toBe(
      "custom",
    );
    expect(
      PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
