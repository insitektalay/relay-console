import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import {
  BlueskyMarketplaceOAuthController,
} from "./bluesky-marketplace.controller";
import { BLUESKY_SCOPE } from "./bluesky-constants";

describe("BlueskyMarketplaceOAuthController", () => {
  it("publishes exact public-client metadata on the Railway origin", () => {
    const config = new ConfigService({
      CLAWCHAT_RAILWAY_ORIGIN:
        "https://clawchat-production-f92c.up.railway.app/api/v1/",
    });
    const controller = new BlueskyMarketplaceOAuthController(config, {} as never);
    expect(controller.clientMetadata()).toEqual({
      client_id:
        "https://clawchat-production-f92c.up.railway.app/api/v1/marketplace/oauth/bluesky/client-metadata.json",
      client_name: "Relay Console",
      client_uri: "https://clawchat-production-f92c.up.railway.app",
      redirect_uris: [
        "https://clawchat-production-f92c.up.railway.app/api/v1/marketplace/oauth/bluesky/callback",
      ],
      scope: BLUESKY_SCOPE,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
      dpop_bound_access_tokens: true,
    });
  });

  it("fails closed without a valid public HTTPS Railway origin", () => {
    for (const origin of [
      "",
      "http://clawchat.example.com",
      "https://clawchat.example.com:8443",
      "https://user@clawchat.example.com",
    ]) {
      const controller = new BlueskyMarketplaceOAuthController(
        new ConfigService({ CLAWCHAT_RAILWAY_ORIGIN: origin }),
        {} as never,
      );
      expect(() => controller.clientMetadata()).toThrow(
        ServiceUnavailableException,
      );
    }
  });
});
