import {
  type OAuthProviderHealthHandler,
  mergeOAuthProviderHealthHandlerMaps,
} from "./oauth-provider-health-handler";
import { OAUTH_PROVIDER_HEALTH_HANDLER_BY_SLUG } from "./oauth-provider-health-registry.index";

describe("OAuth provider health handler registry", () => {
  it("owns every extracted OAuth provider health branch exactly once", () => {
    const slugs = Object.keys(OAUTH_PROVIDER_HEALTH_HANDLER_BY_SLUG);

    expect(slugs).toHaveLength(103);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(OAUTH_PROVIDER_HEALTH_HANDLER_BY_SLUG["outlook"]).toEqual(
      expect.any(Function),
    );
    expect(OAUTH_PROVIDER_HEALTH_HANDLER_BY_SLUG["google-drive"]).toEqual(
      expect.any(Function),
    );
  });

  it("rejects duplicate ownership and freezes the composed registry", () => {
    const handler = (async () => undefined) as OAuthProviderHealthHandler;

    expect(() =>
      mergeOAuthProviderHealthHandlerMaps(
        { example: handler },
        { example: handler },
      ),
    ).toThrow("Duplicate OAuth provider health handler for example");
    expect(Object.isFrozen(OAUTH_PROVIDER_HEALTH_HANDLER_BY_SLUG)).toBe(true);
  });
});
