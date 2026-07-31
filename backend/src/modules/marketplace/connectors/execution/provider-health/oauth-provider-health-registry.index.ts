import { OAuthProviderHealthHandlers } from "./oauth-provider-health.handlers";
import { mergeOAuthProviderHealthHandlerMaps } from "./oauth-provider-health-handler";

export const OAUTH_PROVIDER_HEALTH_HANDLER_BY_SLUG =
  mergeOAuthProviderHealthHandlerMaps(OAuthProviderHealthHandlers);
