import * as providerCatalog from "./catalog/generated-provider-catalog.json";
import { MarketplaceConnectorRegistry } from "./connectors/connector-registry";
import { MARKETPLACE_RELEASE_MANIFEST } from "./marketplace-release-policy";

describe("Marketplace launch cohort security contract", () => {
  it("keeps all 406 launch apps bounded, installable, and honest about verification", () => {
    const cohort = MARKETPLACE_RELEASE_MANIFEST.providers.filter(
      (provider) => provider.connectEligible,
    );
    const providers = new Map(
      providerCatalog.manifests.map((provider) => [provider.slug, provider]),
    );
    const registry = new MarketplaceConnectorRegistry();

    expect(cohort).toHaveLength(406);
    expect(cohort.every((provider) => provider.liveVerified === false)).toBe(true);

    for (const release of cohort) {
      const provider = providers.get(release.slug);
      expect(provider).toBeDefined();
      expect(provider?.authentication.relayOwned).toBe(false);
      expect(provider?.connection.credentialRequirements.length).toBeGreaterThan(0);
    }

    const registered = cohort.filter((provider) => registry.has(provider.slug));
    expect(registered).toHaveLength(406);
    for (const release of registered) {
      const connector = registry.get(release.slug);
      expect(connector?.tools.length).toBeGreaterThan(0);
      expect(connector?.healthChecks.length).toBeGreaterThan(0);
    }

    const excludedConfigureOnly = [
      "birdeye",
      "cj-affiliate",
      "friendbuy",
      "growave",
      "impact",
      "okendo",
      "partnerize",
      "partnerstack",
      "referralcandy",
      "reviews-io",
      "stamped-io",
      "tapfiliate",
      "yotpo",
    ];
    expect(cohort.filter((provider) => !registry.has(provider.slug))).toEqual([]);
    expect(cohort.map((provider) => provider.slug)).toEqual(
      expect.not.arrayContaining(excludedConfigureOnly),
    );
    for (const slug of excludedConfigureOnly) {
      const provider = providers.get(slug);
      expect(provider?.actions.allowed).toHaveLength(0);
      expect(provider?.actions.approvalRequired).toHaveLength(0);
      expect(
        provider?.runtimeSupport.every(
          (runtime) => runtime.installSupport === "unsupported",
        ),
      ).toBe(true);
    }
  });
});
