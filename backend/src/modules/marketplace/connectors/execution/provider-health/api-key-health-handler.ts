import type { MarketplaceConnectionEntity } from "../../../../../entities";
import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import type { StoredConnectorCredentials } from "../../connector-credential.service";
import type { MarketplaceConnectorManifest } from "../../types";

export type ApiKeyHealthHandler = (
  this: MarketplaceConnectorExecutionService,
  manifest: MarketplaceConnectorManifest,
  connection: MarketplaceConnectionEntity,
  stored: StoredConnectorCredentials | null,
) => Promise<void>;

export type ApiKeyHealthHandlerMap = Readonly<
  Record<string, ApiKeyHealthHandler>
>;

export function mergeApiKeyHealthHandlerMaps(
  ...maps: ApiKeyHealthHandlerMap[]
): ApiKeyHealthHandlerMap {
  const handlers: Record<string, ApiKeyHealthHandler> = {};
  for (const map of maps) {
    for (const [slug, handler] of Object.entries(map)) {
      if (handlers[slug]) {
        throw new Error(`Duplicate API-key health handler for ${slug}`);
      }
      handlers[slug] = handler;
    }
  }
  return Object.freeze(handlers);
}
