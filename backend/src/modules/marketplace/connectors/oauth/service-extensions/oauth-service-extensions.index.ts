import { mergeOAuthServiceMethodModules } from "../oauth-service-method-module";
import { OAuth1CompleteExtension } from "./oauth1-complete.extension";
import { OAuth1StartExtension } from "./oauth1-start.extension";
import { OAuthCompleteExtension } from "./oauth-complete.extension";
import { OAuthDeviceExtension } from "./oauth-device.extension";
import { OAuthRefreshExtension } from "./oauth-refresh.extension";
import { OAuthStartExtension } from "./oauth-start.extension";
import { OAuthRevocationExtension01 } from "./revocation-01.extension";
import { OAuthRevocationExtension02 } from "./revocation-02.extension";

export const OAUTH_SERVICE_EXTENSIONS = mergeOAuthServiceMethodModules(
  OAuthStartExtension,
  OAuthDeviceExtension,
  OAuth1StartExtension,
  OAuthCompleteExtension,
  OAuth1CompleteExtension,
  OAuthRefreshExtension,
  OAuthRevocationExtension01,
  OAuthRevocationExtension02,
);

export type OAuthServiceExtensionMethods = typeof OAUTH_SERVICE_EXTENSIONS;
