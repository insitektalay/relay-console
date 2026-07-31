import { mergeOAuthProviderProfileHandlerMaps } from "./oauth-provider-profile-handler";
import { OAUTH_PROVIDER_PROFILE_HANDLER_BY_SLUG } from "./oauth-provider-profile-registry.index";

describe("OAuth provider profile registry", () => {
  it("owns each effective provider profile branch exactly once", () => {
    expect(Object.keys(OAUTH_PROVIDER_PROFILE_HANDLER_BY_SLUG)).toHaveLength(
      180,
    );
  });

  it("rejects duplicate provider ownership", () => {
    const handler = async () => ({});
    expect(() =>
      mergeOAuthProviderProfileHandlerMaps(
        { duplicate: handler },
        { duplicate: handler },
      ),
    ).toThrow("Duplicate OAuth provider profile handler for duplicate");
  });
});
