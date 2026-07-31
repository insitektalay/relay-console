import { OAuthProviderMetadataHandlers01 } from "./oauth-provider-metadata-01.handlers";
import { OAuthProviderMetadataHandlers02 } from "./oauth-provider-metadata-02.handlers";
import { OAuthProviderMetadataHandlers03 } from "./oauth-provider-metadata-03.handlers";
import { OAuthProviderMetadataHandlers04 } from "./oauth-provider-metadata-04.handlers";
import { OAuthProviderMetadataHandlers05 } from "./oauth-provider-metadata-05.handlers";
import { OAuthProviderMetadataHandlers06 } from "./oauth-provider-metadata-06.handlers";
import { mergeOAuthProviderMetadataHandlerMaps } from "./oauth-provider-metadata-handler";

export const OAUTH_PROVIDER_METADATA_HANDLER_BY_SLUG =
  mergeOAuthProviderMetadataHandlerMaps(
    OAuthProviderMetadataHandlers01,
    OAuthProviderMetadataHandlers02,
    OAuthProviderMetadataHandlers03,
    OAuthProviderMetadataHandlers04,
    OAuthProviderMetadataHandlers05,
    OAuthProviderMetadataHandlers06,
  );
