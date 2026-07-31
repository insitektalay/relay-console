import { OAuthProviderProfileHandlers01 } from "./oauth-provider-profile-01.handlers";
import { OAuthProviderProfileHandlers02 } from "./oauth-provider-profile-02.handlers";
import { OAuthProviderProfileHandlers03 } from "./oauth-provider-profile-03.handlers";
import { OAuthProviderProfileHandlers04 } from "./oauth-provider-profile-04.handlers";
import { OAuthProviderProfileHandlers05 } from "./oauth-provider-profile-05.handlers";
import { OAuthProviderProfileHandlers06 } from "./oauth-provider-profile-06.handlers";
import { mergeOAuthProviderProfileHandlerMaps } from "./oauth-provider-profile-handler";

export const OAUTH_PROVIDER_PROFILE_HANDLER_BY_SLUG =
  mergeOAuthProviderProfileHandlerMaps(
    OAuthProviderProfileHandlers01,
    OAuthProviderProfileHandlers02,
    OAuthProviderProfileHandlers03,
    OAuthProviderProfileHandlers04,
    OAuthProviderProfileHandlers05,
    OAuthProviderProfileHandlers06,
  );
