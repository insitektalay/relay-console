import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  createOAuthProviderStrategyMap,
  type OAuthProviderStrategyMap,
} from "./oauth-provider-strategy";
import { OAUTH_PROVIDER_STRATEGY_BY_SLUG } from "./oauth-provider-strategy.index";

function oauthSlugs(): string[] {
  return new MarketplaceConnectorRegistry()
    .list()
    .filter(
      (manifest) =>
        manifest.auth.type === "oauth1" || Boolean(manifest.auth.oauth),
    )
    .map((manifest) => manifest.slug)
    .sort();
}

describe("OAuth provider strategy registry", () => {
  it("registers exactly one strategy for every OAuth manifest", () => {
    expect(Object.keys(OAUTH_PROVIDER_STRATEGY_BY_SLUG).sort()).toEqual(
      oauthSlugs(),
    );
    for (const [slug, strategy] of Object.entries(
      OAUTH_PROVIDER_STRATEGY_BY_SLUG,
    )) {
      expect(strategy.slug).toBe(slug);
    }
  });

  it("rejects duplicate strategies and orphan phase handlers", () => {
    const manifest = new MarketplaceConnectorRegistry().get("outlook")!;
    expect(() =>
      createOAuthProviderStrategyMap([manifest, manifest], {
        profiles: {},
        metadata: {},
        revocations: {},
      }),
    ).toThrow("Duplicate OAuth provider strategy for outlook");

    expect(() =>
      createOAuthProviderStrategyMap([manifest], {
        profiles: {
          orphan: (async () => ({})) as NonNullable<
            OAuthProviderStrategyMap[string]["profile"]
          >,
        },
        metadata: {},
        revocations: {},
      }),
    ).toThrow(
      "OAuth profiles handler orphan has no registered provider strategy",
    );
  });
});
