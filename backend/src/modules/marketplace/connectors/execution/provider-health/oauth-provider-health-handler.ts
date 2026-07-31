import type { MarketplaceConnectionEntity } from "../../../../../entities";
import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import type { MarketplaceConnectorManifest } from "../../types";

export type OAuthProviderHealthToken = Awaited<
  ReturnType<MarketplaceConnectorOAuthService["refreshIfNeeded"]>
>;

export type OAuthProviderHealthHandler = (
  this: MarketplaceConnectorExecutionService,
  manifest: MarketplaceConnectorManifest,
  connection: MarketplaceConnectionEntity,
  token: OAuthProviderHealthToken,
) => Promise<void>;

export type OAuthProviderHealthHandlerMap = Readonly<
  Record<string, OAuthProviderHealthHandler>
>;

export function mergeOAuthProviderHealthHandlerMaps(
  ...maps: OAuthProviderHealthHandlerMap[]
): OAuthProviderHealthHandlerMap {
  const handlers: Record<string, OAuthProviderHealthHandler> = {};
  for (const map of maps) {
    for (const [slug, handler] of Object.entries(map)) {
      if (handlers[slug]) {
        throw new Error(`Duplicate OAuth provider health handler for ${slug}`);
      }
      handlers[slug] = handler;
    }
  }
  return Object.freeze(handlers);
}
