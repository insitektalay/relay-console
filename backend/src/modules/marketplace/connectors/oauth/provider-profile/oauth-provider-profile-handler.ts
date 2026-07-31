import type {
  MarketplaceConnectorOAuthService,
  OAuthTokenResponse,
} from "../../connector-oauth.service";

export type OAuthProviderProfileHandler = (
  this: MarketplaceConnectorOAuthService,
  appSlug: string,
  accessToken: string,
  providerSession?: Record<string, unknown> | null,
  tokenResponse?: OAuthTokenResponse | null,
  grantedScopes?: readonly string[],
) => Promise<Record<string, unknown>>;

export type OAuthProviderProfileHandlerMap = Readonly<
  Record<string, OAuthProviderProfileHandler>
>;

export function mergeOAuthProviderProfileHandlerMaps(
  ...maps: OAuthProviderProfileHandlerMap[]
): OAuthProviderProfileHandlerMap {
  const handlers: Record<string, OAuthProviderProfileHandler> = {};
  for (const map of maps) {
    for (const [slug, handler] of Object.entries(map)) {
      if (handlers[slug]) {
        throw new Error(`Duplicate OAuth provider profile handler for ${slug}`);
      }
      handlers[slug] = handler;
    }
  }
  return Object.freeze(handlers);
}
