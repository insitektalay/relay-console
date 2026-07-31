import { safeConnectorFetch } from "../../safe-connector-fetch";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import type { MarketplaceConnectionEntity } from "../../../../../entities";
import { BadRequestException } from "@nestjs/common";

export const OAuthRevocationExtension02 = {
  async revokeCanvaSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("CANVA_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("CANVA_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret) {
      throw new BadRequestException(
        "Canva revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch("https://api.canva.com/rest/v1/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException("Canva upstream token revocation failed");
    }
  },

  async revokeWebflowSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("WEBFLOW_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("WEBFLOW_CLIENT_SECRET")
      ?.trim();
    if (!accessToken || !clientId || !clientSecret) {
      throw new BadRequestException(
        "Webflow revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch(
      "https://webflow.com/oauth/revoke_authorization",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          access_token: accessToken,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok || body.did_revoke !== true) {
      throw new BadRequestException("Webflow upstream token revocation failed");
    }
  },

  async revokeDropboxPaperSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    if (!token) {
      throw new BadRequestException("Dropbox revocation token is missing");
    }
    const response = await safeConnectorFetch(
      "https://api.dropboxapi.com/2/auth/token/revoke",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      throw new BadRequestException("Dropbox upstream token revocation failed");
    }
  },

  async revokePCloudSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    if (!token)
      throw new BadRequestException("pCloud revocation token is missing");
    const authority = this.pCloudAuthority(
      this.stringOrNull(connection.metadata?.pCloudApiOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${authority.apiOrigin}/logout`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (
      !response.ok ||
      Number(body.result ?? 0) !== 0 ||
      body.auth_deleted !== true
    ) {
      throw new BadRequestException("pCloud upstream token revocation failed");
    }
  },

  async revokeVimeoSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    if (!token)
      throw new BadRequestException("Vimeo revocation token is missing");
    const response = await safeConnectorFetch("https://api.vimeo.com/tokens", {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.vimeo.*+json;version=3.4",
        Authorization: `Bearer ${token}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok && response.status !== 404)
      throw new BadRequestException("Vimeo upstream token revocation failed");
  },

  async revokeFrameIoSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("FRAME_IO_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Frame.io revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://ims-na1.adobelogin.com/ims/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ token }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException(
        "Frame.io upstream token revocation failed",
      );
  },

  async revokeLucidSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.stringOrNull(connection.metadata?.clientId) ??
      this.configService.get<string>("LUCID_CLIENT_ID")?.trim();
    const clientSecret = this.configService
      .get<string>("LUCID_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Lucid revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch(
      "https://api.lucid.co/v1/oauth2/token/revoke",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new BadRequestException("Lucid upstream token revocation failed");
  },

  async revokeMindMeisterSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.configService.get<string>("MINDMEISTER_CLIENT_ID")?.trim();
    const clientSecret = this.configService
      .get<string>("MINDMEISTER_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "MindMeister revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://www.mindmeister.com/oauth2/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException(
        "MindMeister upstream token revocation failed",
      );
  },

  async revokeMeisterTaskSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.configService.get<string>("MEISTERTASK_CLIENT_ID")?.trim();
    const clientSecret = this.configService
      .get<string>("MEISTERTASK_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret) {
      throw new BadRequestException(
        "MeisterTask revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch("https://www.mindmeister.com/oauth2/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "MeisterTask upstream token revocation failed",
      );
    }
  },

  async revokeOtterAiSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.stringOrNull(connection.metadata?.clientId) ??
      this.configService.get<string>("OTTER_CLIENT_ID")?.trim();
    if (!token || !clientId)
      throw new BadRequestException(
        "Otter.ai revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://otter.ai/oauth/revoke_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token, client_id: clientId }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException(
        "Otter.ai upstream token revocation failed",
      );
  },

  async revokeFirefliesAiSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.stringOrNull(connection.metadata?.clientId) ??
      this.configService.get<string>("FIREFLIES_CLIENT_ID")?.trim();
    if (!token || !clientId)
      throw new BadRequestException(
        "Fireflies.ai revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://api.fireflies.ai/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token, client_id: clientId }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException(
        "Fireflies.ai upstream token revocation failed",
      );
  },

  async revokeRememberTheMilkSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.stringOrNull(connection.metadata?.clientId) ??
      this.configService.get<string>("REMEMBER_THE_MILK_CLIENT_ID")?.trim();
    const clientSecret = this.configService
      .get<string>("REMEMBER_THE_MILK_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret) {
      throw new BadRequestException(
        "Remember The Milk revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch(
      "https://www.rememberthemilk.com/oauth/revoke.rtm",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({ token }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      throw new BadRequestException(
        "Remember The Milk upstream token revocation failed",
      );
    }
  },

  async revokeSunsamaSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.stringOrNull(connection.metadata?.clientId) ??
      this.configService.get<string>("SUNSAMA_CLIENT_ID")?.trim();
    if (!token || !clientId) {
      throw new BadRequestException(
        "Sunsama revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch("https://api.sunsama.com/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
        token_type_hint: stored.refreshToken ? "refresh_token" : "access_token",
        client_id: clientId,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException("Sunsama upstream token revocation failed");
    }
  },

  async revokeWhimsicalSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.stringOrNull(connection.metadata?.clientId) ??
      this.configService.get<string>("WHIMSICAL_MCP_CLIENT_ID")?.trim();
    if (!token || !clientId) {
      throw new BadRequestException(
        "Whimsical revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch("https://api.whimsical.com/v1/oauth.revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token, client_id: clientId }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "Whimsical upstream token revocation failed",
      );
    }
  },
};
