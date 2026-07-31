import { OAuthLocalDisconnectHandlers01 } from "./oauth-local-disconnect-01.handlers";
import { OAuthProviderRevocationHandlers01 } from "./oauth-provider-revocation-01.handlers";
import {
  mergeOAuthLocalDisconnectHandlerMaps,
  mergeOAuthProviderRevocationHandlerMaps,
} from "./oauth-provider-disconnect-handler";

export const OAUTH_LOCAL_DISCONNECT_HANDLER_BY_SLUG =
  mergeOAuthLocalDisconnectHandlerMaps(OAuthLocalDisconnectHandlers01);

export const OAUTH_PROVIDER_REVOCATION_HANDLER_BY_SLUG =
  mergeOAuthProviderRevocationHandlerMaps(OAuthProviderRevocationHandlers01);
