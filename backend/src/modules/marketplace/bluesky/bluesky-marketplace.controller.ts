import {
  Controller,
  Get,
  Query,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { Public } from "../../../common/decorators/public.decorator";
import { BlueskyOAuthService } from "./bluesky-oauth.service";
import { BLUESKY_SCOPE } from "./bluesky-constants";

@Public()
@Controller("marketplace/oauth/bluesky")
export class BlueskyMarketplaceOAuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly blueskyOAuthService: BlueskyOAuthService,
  ) {}

  @Get("client-metadata.json")
  clientMetadata() {
    const origin = this.backendOrigin();
    const clientId = `${origin}/api/v1/marketplace/oauth/bluesky/client-metadata.json`;
    return {
      client_id: clientId,
      client_name: "Relay Console",
      client_uri: origin,
      redirect_uris: [`${origin}/api/v1/marketplace/oauth/bluesky/callback`],
      scope: BLUESKY_SCOPE,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
      dpop_bound_access_tokens: true,
    };
  }

  @Get("callback")
  async callback(
    @Query("state") state: string | undefined,
    @Query("code") code: string | undefined,
    @Query("iss") issuer: string | undefined,
    @Query("error") error: string | undefined,
    @Res() response: Response,
  ) {
    if (error) {
      await this.blueskyOAuthService.cancelOAuth(state);
      return response
        .status(400)
        .send("Bluesky authorization was not completed.");
    }
    try {
      const result = await this.blueskyOAuthService.completeOAuth({
        state,
        code,
        issuer,
      });
      if (result.returnTo) return response.redirect(result.returnTo);
      return response
        .status(200)
        .send(
          "Bluesky authorization completed. You can return to Relay Console.",
        );
    } catch {
      return response
        .status(400)
        .send("Bluesky authorization could not be completed.");
    }
  }

  private backendOrigin() {
    const raw =
      this.configService.get<string>("CLAWCHAT_RAILWAY_ORIGIN") ||
      this.configService.get<string>("PUBLIC_API_ORIGIN") ||
      this.configService.get<string>("BACKEND_PUBLIC_ORIGIN") ||
      (this.configService.get<string>("RAILWAY_PUBLIC_DOMAIN")
        ? `https://${this.configService.get<string>("RAILWAY_PUBLIC_DOMAIN")}`
        : "");
    let url: URL;
    try {
      url = new URL(
        raw
          .trim()
          .replace(/\/+$/, "")
          .replace(/\/api\/v1$/, ""),
      );
    } catch {
      throw new ServiceUnavailableException(
        "Bluesky OAuth client metadata requires CLAWCHAT_RAILWAY_ORIGIN",
      );
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new ServiceUnavailableException(
        "Bluesky OAuth client metadata requires a public HTTPS Railway origin",
      );
    }
    return url.origin;
  }
}
