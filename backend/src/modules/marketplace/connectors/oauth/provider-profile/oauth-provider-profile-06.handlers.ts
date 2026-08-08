import { safeConnectorFetch } from "../../safe-connector-fetch";
import type {
  OAuthProviderProfileHandler,
  OAuthProviderProfileHandlerMap,
} from "./oauth-provider-profile-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderProfileHandler135: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://reflect.app/api/users/me",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok || !this.stringOrNull(body.id)) {
      throw new BadRequestException("Reflect connected-user validation failed");
    }
    return body;
  };

const oauthProviderProfileHandler136: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.raindrop.io/rest/v1/user",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const user =
      body.user && typeof body.user === "object" && !Array.isArray(body.user)
        ? (body.user as Record<string, unknown>)
        : {};
    if (
      !response.ok ||
      !(typeof user._id === "number" || this.stringOrNull(user._id))
    )
      throw new BadRequestException(
        "Raindrop.io connected-user validation failed",
      );
    return user;
  };

const oauthProviderProfileHandler137: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://www.inoreader.com/reader/api/0/user-info",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok || !this.stringOrNull(body.userId)) {
      throw new BadRequestException(
        "Inoreader connected-user validation failed",
      );
    }
    return body;
  };

const oauthProviderProfileHandler138: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.getguru.com/api/v1/teams",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const teams = (await response.json().catch(() => [])) as unknown;
    if (
      !response.ok ||
      !Array.isArray(teams) ||
      !teams.some((item) =>
        this.stringOrNull((item as Record<string, unknown>)?.id),
      )
    ) {
      throw new BadRequestException("Guru connected-team validation failed");
    }
    return { teams: teams.slice(0, 100) };
  };

const oauthProviderProfileHandler139: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.resourceguruapp.com/v1/me",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const user =
      body.user && typeof body.user === "object" && !Array.isArray(body.user)
        ? (body.user as Record<string, unknown>)
        : {};
    const accounts = Array.isArray(body.accounts) ? body.accounts : [];
    const identity =
      (typeof user.id === "number" ? String(user.id) : null) ??
      this.stringOrNull(user.id) ??
      this.stringOrNull(user.email) ??
      this.stringOrNull(body.id) ??
      this.stringOrNull(body.email);
    if (!response.ok || (!identity && accounts.length === 0)) {
      throw new BadRequestException(
        "Resource Guru connected-user validation failed",
      );
    }
    return body;
  };

const oauthProviderProfileHandler140: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.timelyapp.com/1.1/accounts",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => [])) as unknown;
    const accounts = (
      Array.isArray(body)
        ? body
        : body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>).accounts
          : []
    ) as unknown;
    const normalizedAccounts = Array.isArray(accounts)
      ? accounts
          .filter(
            (item): item is Record<string, unknown> =>
              !!item && typeof item === "object" && !Array.isArray(item),
          )
          .slice(0, 100)
      : [];
    const firstAccount = normalizedAccounts[0];
    const accountId = firstAccount
      ? typeof firstAccount.id === "number"
        ? String(firstAccount.id)
        : this.stringOrNull(firstAccount.id)
      : null;
    if (!response.ok || !accountId) {
      throw new BadRequestException(
        "Timely connected-workspace validation failed",
      );
    }
    const userResponse = await safeConnectorFetch(
      `https://api.timelyapp.com/1.1/${encodeURIComponent(accountId)}/users/current`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const user = (await userResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!userResponse.ok) {
      throw new BadRequestException("Timely connected-user validation failed");
    }
    return { accounts: normalizedAccounts, user };
  };

const oauthProviderProfileHandler141: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://www.rescuetime.com/api/resource/users",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => [])) as unknown;
    const users = Array.isArray(body) ? body : [];
    const user = users.find(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item),
    );
    const userId = user
      ? typeof user.id === "number"
        ? String(user.id)
        : (this.stringOrNull(user.id) ?? this.stringOrNull(user.email))
      : null;
    if (!response.ok || !user || !userId) {
      throw new BadRequestException(
        "RescueTime connected-user validation failed",
      );
    }
    return { user };
  };

const oauthProviderProfileHandler142: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.hubstaff.com/v2/users/me",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const user =
      body.user && typeof body.user === "object" && !Array.isArray(body.user)
        ? (body.user as Record<string, unknown>)
        : body;
    const userId =
      typeof user.id === "number"
        ? String(user.id)
        : this.stringOrNull(user.id);
    if (!response.ok || !userId) {
      throw new BadRequestException(
        "Hubstaff connected-user validation failed",
      );
    }
    return { user };
  };

const oauthProviderProfileHandler143: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const claims =
      providerSession?.sliteClaims &&
      typeof providerSession.sliteClaims === "object" &&
      !Array.isArray(providerSession.sliteClaims)
        ? (providerSession.sliteClaims as Record<string, unknown>)
        : {};
    const subject = this.stringOrNull(claims.sub);
    const email = this.stringOrNull(claims.email);
    if (!subject || !email) {
      throw new BadRequestException("Slite OIDC identity binding is invalid");
    }
    await this.sliteMcp.health(accessToken);
    return claims;
  };

const oauthProviderProfileHandler144: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const health = await this.nuclinoMcp.health(accessToken);
    return health;
  };

const oauthProviderProfileHandler145: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.scribeMcp.health(accessToken);
  };

const oauthProviderProfileHandler146: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.otterAiMcp.health(accessToken);
  };

const oauthProviderProfileHandler147: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.firefliesAiMcp.health(accessToken);
  };

const oauthProviderProfileHandler148: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.anyDoMcp.health(accessToken);
  };

const oauthProviderProfileHandler149: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.akiflowMcp.health(accessToken);
  };

const oauthProviderProfileHandler150: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.sunsamaMcp.health(accessToken);
  };

const oauthProviderProfileHandler151: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.rememberTheMilkMcp.health(accessToken);
  };

const oauthProviderProfileHandler152: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.fathomMcp.health(accessToken);
  };

const oauthProviderProfileHandler153: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.bonsaiMcp.health(accessToken);
  };

const oauthProviderProfileHandler154: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.grainMcp.health(accessToken);
  };

const oauthProviderProfileHandler155: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.whimsicalMcp.health(accessToken);
  };

const oauthProviderProfileHandler156: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.cognitoFormsMcp.health(accessToken);
  };

const oauthProviderProfileHandler164: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    tokenResponse,
    grantedScopes,
  ) {
    return this.jotformMcp.health(
      accessToken,
      grantedScopes?.includes("full") ||
        (!grantedScopes?.length && tokenResponse?.scope === "full")
        ? "full"
        : "readOnly",
    );
  };

const oauthProviderProfileHandler165: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
  ) {
    return this.craftMcp.health(accessToken);
  };

const oauthProviderProfileHandler157: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.xmindMcp.health(accessToken);
  };

const oauthProviderProfileHandler158: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.adobeAnalyticsMcp.health(accessToken);
  };

const oauthProviderProfileHandler159: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.cloudinaryMcp.health(accessToken);
  };

const oauthProviderProfileHandler160: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://www.mindmeister.com/api/v2/users/me",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId =
      typeof body.id === "number"
        ? String(body.id)
        : this.stringOrNull(body.id);
    if (!response.ok || !userId)
      throw new BadRequestException(
        "MindMeister connected-user validation failed",
      );
    return body;
  };

const oauthProviderProfileHandler161: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const url = new URL("https://api.mixcloud.com/me/");
    url.searchParams.set("access_token", accessToken);
    const response = await safeConnectorFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const key = this.stringOrNull(body.key);
    const name = this.stringOrNull(body.name);
    if (!response.ok || !key || !/^\/[A-Za-z0-9_.:+-]+\/$/.test(key))
      throw new BadRequestException(
        "Mixcloud authorization is not bound to one valid user",
      );
    return {
      mixcloudUserKey: key,
      mixcloudUserName: name?.slice(0, 200) ?? null,
    };
  };

const oauthProviderProfileHandler162: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.audius.co/v1/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : body;
    const userId = this.stringOrNull(data.id) ?? this.stringOrNull(data.userId);
    const handle = this.stringOrNull(data.handle);
    if (!response.ok || !userId || !handle)
      throw new BadRequestException(
        "Audius authorization is not bound to one valid user",
      );
    return {
      audiusUserId: userId.slice(0, 200),
      audiusHandle: handle.slice(0, 200),
      audiusDisplayName: (this.stringOrNull(data.name) ?? handle).slice(0, 200),
    };
  };

const oauthProviderProfileHandler163: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const url = new URL("https://api.podbean.com/v1/podcast");
    url.searchParams.set("access_token", accessToken);
    const response = await safeConnectorFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const podcastId = this.stringOrNull(body.id);
    if (!response.ok || !podcastId)
      throw new BadRequestException(
        "Podbean authorization is not bound to one valid podcast",
      );
    return {
      podbeanPodcastId: podcastId.slice(0, 200),
      podbeanPodcastTitle: this.stringOrNull(body.title)?.slice(0, 200) ?? null,
    };
  };

export const OAuthProviderProfileHandlers06: OAuthProviderProfileHandlerMap =
  Object.freeze({
    reflect: oauthProviderProfileHandler135,
    "raindrop-io": oauthProviderProfileHandler136,
    inoreader: oauthProviderProfileHandler137,
    guru: oauthProviderProfileHandler138,
    "resource-guru": oauthProviderProfileHandler139,
    "timely-time-tracking": oauthProviderProfileHandler140,
    rescuetime: oauthProviderProfileHandler141,
    hubstaff: oauthProviderProfileHandler142,
    slite: oauthProviderProfileHandler143,
    nuclino: oauthProviderProfileHandler144,
    scribe: oauthProviderProfileHandler145,
    "otter-ai": oauthProviderProfileHandler146,
    "fireflies-ai": oauthProviderProfileHandler147,
    "any-do": oauthProviderProfileHandler148,
    akiflow: oauthProviderProfileHandler149,
    sunsama: oauthProviderProfileHandler150,
    "remember-the-milk": oauthProviderProfileHandler151,
    fathom: oauthProviderProfileHandler152,
    bonsai: oauthProviderProfileHandler153,
    grain: oauthProviderProfileHandler154,
    whimsical: oauthProviderProfileHandler155,
    "cognito-forms": oauthProviderProfileHandler156,
    jotform: oauthProviderProfileHandler164,
    craft: oauthProviderProfileHandler165,
    xmind: oauthProviderProfileHandler157,
    "adobe-analytics": oauthProviderProfileHandler158,
    cloudinary: oauthProviderProfileHandler159,
    mindmeister: oauthProviderProfileHandler160,
    mixcloud: oauthProviderProfileHandler161,
    audius: oauthProviderProfileHandler162,
    podbean: oauthProviderProfileHandler163,
  });
