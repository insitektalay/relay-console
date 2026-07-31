import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";

type BuildMetadataParameters = Parameters<
  MarketplaceConnectorOAuthService["buildMetadata"]
>;

export type OAuthProviderMetadataHandler = (
  this: MarketplaceConnectorOAuthService,
  appSlug: BuildMetadataParameters[0],
  clientId: BuildMetadataParameters[1],
  grantedScopes: BuildMetadataParameters[2],
  profileObject: Record<string, unknown>,
  authority: BuildMetadataParameters[4],
) => Record<string, unknown>;

export type OAuthProviderMetadataHandlerMap = Readonly<
  Record<string, OAuthProviderMetadataHandler>
>;

export function mergeOAuthProviderMetadataHandlerMaps(
  ...maps: OAuthProviderMetadataHandlerMap[]
): OAuthProviderMetadataHandlerMap {
  const handlers: Record<string, OAuthProviderMetadataHandler> = {};
  for (const map of maps) {
    for (const [slug, handler] of Object.entries(map)) {
      if (handlers[slug]) {
        throw new Error(
          `Duplicate OAuth provider metadata handler for ${slug}`,
        );
      }
      handlers[slug] = handler;
    }
  }
  return Object.freeze(handlers);
}
