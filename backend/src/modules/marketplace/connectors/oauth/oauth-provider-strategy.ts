import type { MarketplaceConnectorManifest } from "../types";
import type { OAuthProviderRevocationHandlerMap } from "./provider-disconnect/oauth-provider-disconnect-handler";
import type { OAuthProviderMetadataHandlerMap } from "./provider-metadata/oauth-provider-metadata-handler";
import type { OAuthProviderProfileHandlerMap } from "./provider-profile/oauth-provider-profile-handler";

export type OAuthProviderStrategy = Readonly<{
  slug: string;
  authType: MarketplaceConnectorManifest["auth"]["type"];
  profile: OAuthProviderProfileHandlerMap[string] | null;
  metadata: OAuthProviderMetadataHandlerMap[string] | null;
  revoke: OAuthProviderRevocationHandlerMap[string] | null;
}>;

export type OAuthProviderStrategyMap = Readonly<
  Record<string, OAuthProviderStrategy>
>;

type OAuthProviderStrategyPhases = Readonly<{
  profiles: OAuthProviderProfileHandlerMap;
  metadata: OAuthProviderMetadataHandlerMap;
  revocations: OAuthProviderRevocationHandlerMap;
}>;

function isOAuthManifest(manifest: MarketplaceConnectorManifest): boolean {
  return manifest.auth.type === "oauth1" || Boolean(manifest.auth.oauth);
}

export function createOAuthProviderStrategyMap(
  manifests: readonly MarketplaceConnectorManifest[],
  phases: OAuthProviderStrategyPhases,
): OAuthProviderStrategyMap {
  const strategies: Record<string, OAuthProviderStrategy> = {};
  for (const manifest of manifests) {
    if (!isOAuthManifest(manifest)) continue;
    if (strategies[manifest.slug]) {
      throw new Error(`Duplicate OAuth provider strategy for ${manifest.slug}`);
    }
    strategies[manifest.slug] = Object.freeze({
      slug: manifest.slug,
      authType: manifest.auth.type,
      profile: phases.profiles[manifest.slug] ?? null,
      metadata: phases.metadata[manifest.slug] ?? null,
      revoke: phases.revocations[manifest.slug] ?? null,
    });
  }

  for (const [phase, handlers] of Object.entries(phases)) {
    for (const slug of Object.keys(handlers)) {
      if (!strategies[slug]) {
        throw new Error(
          `OAuth ${phase} handler ${slug} has no registered provider strategy`,
        );
      }
    }
  }
  return Object.freeze(strategies);
}
