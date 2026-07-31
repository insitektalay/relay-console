import {
  installOAuthServiceMethodModules,
  mergeOAuthServiceMethodModules,
} from "./oauth-service-method-module";
import { OAUTH_SERVICE_EXTENSIONS } from "./service-extensions/oauth-service-extensions.index";

describe("OAuth service method modules", () => {
  it("merges distinct method modules", () => {
    expect(
      mergeOAuthServiceMethodModules({ first() {} }, { second() {} }),
    ).toEqual({
      first: expect.any(Function),
      second: expect.any(Function),
    });
  });

  it("rejects duplicate and prototype method ownership", () => {
    expect(() =>
      mergeOAuthServiceMethodModules({ duplicate() {} }, { duplicate() {} }),
    ).toThrow("Duplicate OAuth service method duplicate");
    expect(() =>
      installOAuthServiceMethodModules({ retained() {} }, { retained() {} }),
    ).toThrow(
      "OAuth service method retained conflicts with the service prototype",
    );
  });

  it("installs every extracted OAuth lifecycle boundary", () => {
    expect(Object.keys(OAUTH_SERVICE_EXTENSIONS)).toEqual(
      expect.arrayContaining([
        "getOAuthConfig",
        "startOAuth",
        "startSentryDeviceOAuth",
        "startOAuth1",
        "completeOAuth",
        "completeOAuth1",
        "refreshIfNeeded",
        "refreshIfNeededUnlocked",
        "revokeSlackSession",
      ]),
    );
  });
});
