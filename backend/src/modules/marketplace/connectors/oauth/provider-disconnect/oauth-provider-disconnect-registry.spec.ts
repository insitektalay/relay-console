import {
  mergeOAuthLocalDisconnectHandlerMaps,
  mergeOAuthProviderRevocationHandlerMaps,
} from "./oauth-provider-disconnect-handler";
import {
  OAUTH_LOCAL_DISCONNECT_HANDLER_BY_SLUG,
  OAUTH_PROVIDER_REVOCATION_HANDLER_BY_SLUG,
} from "./oauth-provider-disconnect-registry.index";

describe("OAuth provider disconnect registries", () => {
  it("owns local secret disconnects and remote revocations", () => {
    expect(Object.keys(OAUTH_LOCAL_DISCONNECT_HANDLER_BY_SLUG)).toHaveLength(
      14,
    );
    expect(Object.keys(OAUTH_PROVIDER_REVOCATION_HANDLER_BY_SLUG)).toHaveLength(
      90,
    );
    expect(OAUTH_PROVIDER_REVOCATION_HANDLER_BY_SLUG.jotform).toBeUndefined();
  });

  it("rejects duplicate ownership", () => {
    const local = OAUTH_LOCAL_DISCONNECT_HANDLER_BY_SLUG.wiza;
    const revoke = OAUTH_PROVIDER_REVOCATION_HANDLER_BY_SLUG.mastodon;
    expect(() =>
      mergeOAuthLocalDisconnectHandlerMaps(
        { duplicate: local },
        { duplicate: local },
      ),
    ).toThrow("Duplicate OAuth local disconnect handler for duplicate");
    expect(() =>
      mergeOAuthProviderRevocationHandlerMaps(
        { duplicate: revoke },
        { duplicate: revoke },
      ),
    ).toThrow("Duplicate OAuth provider revocation handler for duplicate");
  });
});
