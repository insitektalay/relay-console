import { MarketplaceConnectorRegistry } from "../connector-registry";
import { createOAuthProviderStrategyMap } from "./oauth-provider-strategy";
import { OAUTH_PROVIDER_REVOCATION_HANDLER_BY_SLUG } from "./provider-disconnect/oauth-provider-disconnect-registry.index";
import { OAUTH_PROVIDER_METADATA_HANDLER_BY_SLUG } from "./provider-metadata/oauth-provider-metadata-registry.index";
import { OAUTH_PROVIDER_PROFILE_HANDLER_BY_SLUG } from "./provider-profile/oauth-provider-profile-registry.index";

export const OAUTH_PROVIDER_STRATEGY_BY_SLUG = createOAuthProviderStrategyMap(
  new MarketplaceConnectorRegistry().list(),
  {
    profiles: OAUTH_PROVIDER_PROFILE_HANDLER_BY_SLUG,
    metadata: OAUTH_PROVIDER_METADATA_HANDLER_BY_SLUG,
    revocations: OAUTH_PROVIDER_REVOCATION_HANDLER_BY_SLUG,
  },
);
