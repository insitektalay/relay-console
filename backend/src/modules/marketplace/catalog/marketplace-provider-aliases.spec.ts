import { MARKETPLACE_CATALOG } from "./marketplace-catalog";
import {
  canonicalMarketplaceProviderSlug,
  MARKETPLACE_PROVIDER_ALIASES,
} from "./marketplace-provider-aliases";

describe("Marketplace provider aliases", () => {
  it("resolves the legacy Exa slug to the canonical Swift-compatible identity", () => {
    expect(canonicalMarketplaceProviderSlug("exa")).toBe("exa-search");
    expect(canonicalMarketplaceProviderSlug(" Exa ")).toBe("exa-search");
    expect(MARKETPLACE_PROVIDER_ALIASES).toContainEqual(
      expect.objectContaining({
        aliasSlug: "exa",
        canonicalSlug: "exa-search",
        classification: "legacy_slug",
        publishStandalone: false,
        shareCanonicalConnectionState: true,
      }),
    );
  });

  it("resolves Notarize to one shared Proof provider identity", () => {
    expect(canonicalMarketplaceProviderSlug("notarize")).toBe("proof");
    expect(canonicalMarketplaceProviderSlug(" Notarize ")).toBe("proof");
    expect(MARKETPLACE_PROVIDER_ALIASES).toContainEqual(
      expect.objectContaining({
        aliasSlug: "notarize",
        canonicalSlug: "proof",
        publishStandalone: false,
        shareCanonicalConnectionState: true,
      }),
    );
  });

  it("does not publish a duplicate standalone Notarize card", () => {
    expect(MARKETPLACE_CATALOG.some((app) => app.slug === "notarize")).toBe(
      false,
    );
  });

  it("publishes exactly one canonical Exa Search card", () => {
    expect(
      MARKETPLACE_CATALOG.filter(
        (app) => app.slug === "exa" || app.slug === "exa-search",
      ).map((app) => app.slug),
    ).toEqual(["exa-search"]);
  });
});
