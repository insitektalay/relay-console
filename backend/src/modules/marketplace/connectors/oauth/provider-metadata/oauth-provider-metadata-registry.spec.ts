import { mergeOAuthProviderMetadataHandlerMaps } from "./oauth-provider-metadata-handler";
import { OAUTH_PROVIDER_METADATA_HANDLER_BY_SLUG } from "./oauth-provider-metadata-registry.index";

describe("OAuth provider metadata registry", () => {
  it("owns each effective provider metadata branch exactly once", () => {
    expect(Object.keys(OAUTH_PROVIDER_METADATA_HANDLER_BY_SLUG)).toHaveLength(
      178,
    );
  });

  it("rejects duplicate provider ownership", () => {
    const handler = () => ({});
    expect(() =>
      mergeOAuthProviderMetadataHandlerMaps(
        { duplicate: handler },
        { duplicate: handler },
      ),
    ).toThrow("Duplicate OAuth provider metadata handler for duplicate");
  });
});
