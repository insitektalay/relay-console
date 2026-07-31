import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { runOAuthCompletePhases } from "./oauth-complete-phases-final";

export const OAuthCompleteExtension = {
  async completeOAuth(
    this: MarketplaceConnectorOAuthService,
    appSlug: string,
    input: {
      state: string;
      code: string;
      companyGuid?: string;
      companyId?: string;
      realmId?: string;
      businessId?: string;
      location?: string;
      accountsServer?: string;
      pCloudLocationId?: string;
      pCloudHostname?: string;
      subdomain?: string;
      accountSubdomain?: string;
      apicp?: string;
      appcp?: string;
      callbackHmac?: string;
      shopifyHmac?: string;
      shopifyShop?: string;
      shopifyTimestamp?: string;
      rawCallbackPathAndQuery?: string;
      adobeApiAccessPoint?: string;
    },
  ) {
    const manifest = this.requireOAuthManifest(appSlug);
    if (manifest.auth.type === "oauth1") {
      return this.completeOAuth1(manifest.slug, input);
    }
    return runOAuthCompletePhases(this, { appSlug, input });
  },
};
