import type { MarketplaceConnectionEntity } from "../../../../../entities";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";

export type OAuthLocalDisconnectHandler = (
  this: MarketplaceConnectorOAuthService,
  workspaceId: string,
  userId: string,
  appSlug: string,
  connectionId: string,
) => Promise<ReturnType<MarketplaceConnectorOAuthService["toConnectionView"]>>;

export type OAuthLocalDisconnectHandlerMap = Readonly<
  Record<string, OAuthLocalDisconnectHandler>
>;

export type OAuthProviderRevocationHandler = (
  this: MarketplaceConnectorOAuthService,
  stored: Record<string, unknown>,
  connection: MarketplaceConnectionEntity,
) => Promise<void>;

export type OAuthProviderRevocationHandlerMap = Readonly<
  Record<string, OAuthProviderRevocationHandler>
>;

function mergeHandlerMaps<Handler>(
  duplicateLabel: string,
  maps: ReadonlyArray<Readonly<Record<string, Handler>>>,
): Readonly<Record<string, Handler>> {
  const handlers: Record<string, Handler> = {};
  for (const map of maps) {
    for (const [slug, handler] of Object.entries(map)) {
      if (handlers[slug]) {
        throw new Error(`Duplicate ${duplicateLabel} handler for ${slug}`);
      }
      handlers[slug] = handler;
    }
  }
  return Object.freeze(handlers);
}

export function mergeOAuthLocalDisconnectHandlerMaps(
  ...maps: OAuthLocalDisconnectHandlerMap[]
): OAuthLocalDisconnectHandlerMap {
  return mergeHandlerMaps("OAuth local disconnect", maps);
}

export function mergeOAuthProviderRevocationHandlerMaps(
  ...maps: OAuthProviderRevocationHandlerMap[]
): OAuthProviderRevocationHandlerMap {
  return mergeHandlerMaps("OAuth provider revocation", maps);
}
