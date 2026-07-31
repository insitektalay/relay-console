import { safeConnectorFetch } from "../../safe-connector-fetch";
import type {
  OAuthProviderProfileHandler,
  OAuthProviderProfileHandlerMap,
} from "./oauth-provider-profile-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";
import { MastodonApiError } from "../../mastodon/mastodon-api.adapter";
import { relayGoogleProviderName } from "../oauth-google-provider-name";

const oauthProviderProfileHandler001: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.rightsignature.com/public/v2/documents?per_page=1&page=1&state=pending",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 100_000)
      throw new BadRequestException(
        "RightSignature read-scope validation response exceeded Relay bounds",
      );
    try {
      if (raw) JSON.parse(raw);
    } catch {
      throw new BadRequestException(
        "RightSignature read-scope validation returned invalid JSON",
      );
    }
    if (!response.ok)
      throw new BadRequestException(
        "RightSignature read-scope validation failed",
      );
    return { rightSignatureDocumentReadVerified: true };
  };

const oauthProviderProfileHandler002: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.signeasy.com/v3/rs/", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 100_000)
      throw new BadRequestException(
        "Signeasy envelope-read validation response exceeded Relay bounds",
      );
    try {
      if (raw) JSON.parse(raw);
    } catch {
      throw new BadRequestException(
        "Signeasy envelope-read validation returned invalid JSON",
      );
    }
    if (!response.ok)
      throw new BadRequestException("Signeasy envelope-read validation failed");
    return { signeasyEnvelopeReadVerified: true };
  };

const oauthProviderProfileHandler003: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://signrequest.com/api/v1/documents/?limit=1",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 100_000)
      throw new BadRequestException(
        "SignRequest read-scope validation response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "SignRequest read-scope validation returned invalid JSON",
      );
    }
    if (!response.ok || !Array.isArray(body.results))
      throw new BadRequestException("SignRequest read-scope validation failed");
    return { signRequestReadScopeVerified: true };
  };

const oauthProviderProfileHandler004: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.signnow.com/user", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 100_000)
      throw new BadRequestException(
        "SignNow connected-user response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "SignNow connected-user validation returned invalid JSON",
      );
    }
    const userId =
      this.stringOrNull(body.id) ?? this.stringOrNull(body.user_id);
    if (!response.ok || !userId || !/^[A-Za-z0-9_-]{1,256}$/.test(userId))
      throw new BadRequestException("SignNow connected-user validation failed");
    return { signNowUserId: userId };
  };

const oauthProviderProfileHandler005: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.adobeAcrobatSignAuthority(
      this.stringOrNull(providerSession?.adobeAcrobatSignApiOrigin) ?? "",
    );
    const response = await safeConnectorFetch(
      `${authority.apiOrigin}/api/rest/v6/base_uris`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 100_000)
      throw new BadRequestException(
        "Adobe Acrobat Sign API shard response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Adobe Acrobat Sign API shard validation returned invalid JSON",
      );
    }
    const confirmed = this.adobeAcrobatSignAuthority(
      this.stringOrNull(body.apiAccessPoint) ?? "",
    );
    if (!response.ok || confirmed.apiOrigin !== authority.apiOrigin)
      throw new BadRequestException(
        "Adobe Acrobat Sign API shard validation failed",
      );
    return {
      adobeAcrobatSignApiOrigin: confirmed.apiOrigin,
      adobeAcrobatSignShard: new URL(confirmed.apiOrigin).hostname,
    };
  };

const oauthProviderProfileHandler006: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    try {
      const origin = this.mastodonApi.normalizeInstanceOrigin(
        providerSession?.mastodonInstanceOrigin,
      );
      const account = await this.mastodonApi.getAccount(origin, accessToken);
      return {
        mastodonInstanceOrigin: origin,
        mastodonInstanceDomain: this.stringOrNull(
          providerSession?.mastodonInstanceDomain,
        ),
        mastodonInstanceVersion: this.stringOrNull(
          providerSession?.mastodonInstanceVersion,
        ),
        mastodonMaxCharacters: providerSession?.mastodonMaxCharacters,
        mastodonAccountId: account.accountId,
        mastodonUsername: account.username,
        mastodonAcct: account.acct,
        mastodonDisplayName: account.displayName,
        mastodonAccountUrl: account.url,
        mastodonLocked: account.locked,
        mastodonBot: account.bot,
      };
    } catch (error) {
      if (error instanceof MastodonApiError)
        throw new BadRequestException(error.message);
      throw error;
    }
  };

const oauthProviderProfileHandler007: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const url = new URL("https://graph.threads.net/me");
    url.searchParams.set(
      "fields",
      "id,username,name,is_verified,threads_profile_picture_url,threads_biography",
    );
    const response = await safeConnectorFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Threads profile response exceeded Relay bounds",
      );
    let profile: Record<string, unknown>;
    try {
      profile = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Threads profile response was invalid JSON",
      );
    }
    const profileId = this.stringOrNull(profile.id);
    const username = this.stringOrNull(profile.username);
    if (
      !response.ok ||
      !profileId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(profileId) ||
      !username
    )
      throw new BadRequestException(
        "Threads authorization could not verify its exact app-scoped profile",
      );
    return {
      threadsProfileId: profileId,
      threadsUsername: username.slice(0, 64),
      threadsName: this.stringOrNull(profile.name)?.slice(0, 200) ?? null,
      threadsVerified: profile.is_verified === true,
    };
  };

const oauthProviderProfileHandler008: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.pinterest.com/v5/user_account", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Pinterest profile response exceeded Relay bounds",
      );
    let profile: Record<string, unknown>;
    try {
      profile = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Pinterest profile response was invalid JSON",
      );
    }
    const accountId = this.stringOrNull(profile.id);
    const username = this.stringOrNull(profile.username);
    if (
      !response.ok ||
      !accountId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(accountId) ||
      !username ||
      !/^[A-Za-z0-9_.-]{1,64}$/.test(username)
    )
      throw new BadRequestException(
        "Pinterest authorization could not verify its exact user account",
      );
    return {
      pinterestUserAccountId: accountId,
      pinterestUsername: username,
      pinterestDisplayName:
        this.stringOrNull(profile.business_name)?.slice(0, 200) ?? username,
      pinterestAccountType:
        this.stringOrNull(profile.account_type)?.slice(0, 50) ?? null,
    };
  };

const oauthProviderProfileHandler009: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.tumblr.com/v2/user/info", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "ClawChat-Tumblr/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Tumblr profile response exceeded Relay bounds",
      );
    let root: Record<string, unknown>;
    try {
      root = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("Tumblr profile response was invalid JSON");
    }
    const profileResponse =
      root.response &&
      typeof root.response === "object" &&
      !Array.isArray(root.response)
        ? (root.response as Record<string, unknown>)
        : {};
    const user =
      profileResponse.user &&
      typeof profileResponse.user === "object" &&
      !Array.isArray(profileResponse.user)
        ? (profileResponse.user as Record<string, unknown>)
        : {};
    const accountName = this.stringOrNull(user.name);
    const blogs = (Array.isArray(user.blogs) ? user.blogs : [])
      .map((value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null,
      )
      .filter((value): value is Record<string, unknown> => value !== null);
    const selectedBlog =
      blogs.find((blog) => blog.primary === true && blog.type !== "private") ??
      blogs.find((blog) => blog.type !== "private");
    const blogUuid = this.stringOrNull(selectedBlog?.uuid);
    const blogName = this.stringOrNull(selectedBlog?.name);
    if (
      !response.ok ||
      !accountName ||
      !blogUuid ||
      !/^t:[A-Za-z0-9_-]{1,128}$/.test(blogUuid) ||
      !blogName
    )
      throw new BadRequestException(
        "Tumblr authorization could not verify an account and owned blog",
      );
    return {
      tumblrAccountName: accountName.slice(0, 128),
      tumblrSelectedBlogUuid: blogUuid,
      tumblrSelectedBlogName: blogName.slice(0, 128),
      tumblrSelectedBlogTitle:
        this.stringOrNull(selectedBlog?.title)?.slice(0, 300) ?? null,
      tumblrSelectedBlogUrl:
        this.stringOrNull(selectedBlog?.url)?.slice(0, 2_048) ?? null,
      tumblrSelectedBlogPrimary: selectedBlog?.primary === true,
      tumblrSelectedBlogType:
        this.stringOrNull(selectedBlog?.type)?.slice(0, 50) ?? null,
    };
  };

const oauthProviderProfileHandler010: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const token = accessToken.trim();
    if (!token || token.length > 16_000 || /[\r\n]/.test(token))
      throw new BadRequestException(
        "Aircall company validation requires a valid access token",
      );
    const get = async (path: string) => {
      let response: Response;
      try {
        response = await safeConnectorFetch(`https://api.aircall.io/v1${path}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "RelayConsole-Aircall/1.0",
          },
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        });
      } catch {
        throw new BadRequestException(
          "Aircall company validation could not reach the provider",
        );
      }
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > 512 * 1024)
        throw new BadRequestException(
          "Aircall response exceeded the allowed size",
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 512 * 1024)
        throw new BadRequestException(
          "Aircall response exceeded the allowed size",
        );
      if (!response.ok)
        throw new BadRequestException("Aircall company validation failed");
      try {
        const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        throw new BadRequestException("Aircall response was invalid");
      }
    };
    return {
      aircallIntegration: await get("/integrations/me"),
      aircallCompany: await get("/company"),
    };
  };

const oauthProviderProfileHandler011: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://classroom.googleapis.com/v1/courses?pageSize=1",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new BadRequestException(
        "Classroom requesting-user response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Classroom requesting-user validation returned invalid JSON",
      );
    }
    if (!response.ok || !Array.isArray(body.courses))
      throw new BadRequestException(
        "Classroom requesting-user validation failed",
      );
    return {
      googleClassroomAccountLabel: "Connected Classroom user",
      googleClassroomCourseAccessVerified: true,
    };
  };

const oauthProviderProfileHandler012: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet%2CcontentDetails%2Cstatistics%2Cstatus&mine=true&maxResults=1",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new BadRequestException(
        "YouTube connected-channel response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "YouTube connected-channel validation returned invalid JSON",
      );
    }
    const items = Array.isArray(body.items) ? body.items : [];
    const channel =
      items.length === 1 &&
      items[0] &&
      typeof items[0] === "object" &&
      !Array.isArray(items[0])
        ? (items[0] as Record<string, unknown>)
        : {};
    const snippet =
      channel.snippet &&
      typeof channel.snippet === "object" &&
      !Array.isArray(channel.snippet)
        ? (channel.snippet as Record<string, unknown>)
        : {};
    const content =
      channel.contentDetails &&
      typeof channel.contentDetails === "object" &&
      !Array.isArray(channel.contentDetails)
        ? (channel.contentDetails as Record<string, unknown>)
        : {};
    const related =
      content.relatedPlaylists &&
      typeof content.relatedPlaylists === "object" &&
      !Array.isArray(content.relatedPlaylists)
        ? (content.relatedPlaylists as Record<string, unknown>)
        : {};
    const channelId = this.stringOrNull(channel.id);
    if (
      !response.ok ||
      !channelId ||
      !/^UC[A-Za-z0-9_-]{1,62}$/.test(channelId)
    )
      throw new BadRequestException(
        "YouTube connected-channel validation failed",
      );
    return {
      youtubeChannelId: channelId,
      youtubeChannelTitle:
        this.stringOrNull(snippet.title)?.slice(0, 256) ?? channelId,
      youtubeUploadsPlaylistId:
        this.stringOrNull(related.uploads)?.slice(0, 128) ?? null,
    };
  };

const oauthProviderProfileHandler013: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const accountName = this.googleMerchantCenterAccountName(
      providerSession?.accountName,
    );
    const response = await safeConnectorFetch(
      `https://merchantapi.googleapis.com/accounts/v1/${accountName}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new BadRequestException(
        "Merchant Center account response exceeded Relay bounds",
      );
    let account: Record<string, unknown>;
    try {
      account = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Merchant Center account validation returned invalid JSON",
      );
    }
    if (!response.ok || this.stringOrNull(account.name) !== accountName)
      throw new BadRequestException(
        "Merchant Center connected-account validation failed",
      );
    return {
      googleMerchantCenterAccountName: accountName,
      googleMerchantCenterAccountDisplayName:
        this.stringOrNull(account.accountName)?.slice(0, 256) ?? null,
    };
  };

const oauthProviderProfileHandler014: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const accountName = this.googleBusinessProfileAccountName(
      providerSession?.accountName,
    );
    const locationName = this.googleBusinessProfileLocationName(
      providerSession?.locationName,
    );
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    const [accountResponse, locationResponse] = await Promise.all([
      safeConnectorFetch(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${accountName}`,
        {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      ),
      safeConnectorFetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=name,title,metadata`,
        {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      ),
    ]);
    const [accountRaw, locationRaw] = await Promise.all([
      accountResponse.text(),
      locationResponse.text(),
    ]);
    if (
      Buffer.byteLength(accountRaw) + Buffer.byteLength(locationRaw) >
      1_048_576
    )
      throw new BadRequestException(
        "Google Business Profile validation response exceeded Relay bounds",
      );
    let account: Record<string, unknown>;
    let location: Record<string, unknown>;
    try {
      account = (accountRaw ? JSON.parse(accountRaw) : {}) as Record<
        string,
        unknown
      >;
      location = (locationRaw ? JSON.parse(locationRaw) : {}) as Record<
        string,
        unknown
      >;
    } catch {
      throw new BadRequestException(
        "Google Business Profile validation returned invalid JSON",
      );
    }
    if (
      !accountResponse.ok ||
      !locationResponse.ok ||
      this.stringOrNull(account.name) !== accountName ||
      this.stringOrNull(location.name) !== locationName
    )
      throw new BadRequestException(
        "Google Business Profile account/location validation failed",
      );
    return {
      googleBusinessProfileAccountName: accountName,
      googleBusinessProfileAccountDisplayName:
        this.stringOrNull(account.accountName)?.slice(0, 256) ?? null,
      googleBusinessProfileLocationName: locationName,
      googleBusinessProfileLocationTitle:
        this.stringOrNull(location.title)?.slice(0, 256) ?? null,
    };
  };

const oauthProviderProfileHandler015: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const siteUrl = this.googleSearchConsoleSiteUrl(providerSession?.siteUrl);
    const response = await safeConnectorFetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
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
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_048_576)
      throw new BadRequestException(
        "Google Search Console property response exceeded Relay bounds",
      );
    let property: Record<string, unknown>;
    try {
      property = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Google Search Console property validation returned invalid JSON",
      );
    }
    if (!response.ok || this.stringOrNull(property.siteUrl) !== siteUrl)
      throw new BadRequestException(
        "Google Search Console connected-property validation failed",
      );
    return {
      googleSearchConsoleSiteUrl: siteUrl,
      googleSearchConsolePermissionLevel:
        this.stringOrNull(property.permissionLevel)?.slice(0, 64) ?? null,
    };
  };

const oauthProviderProfileHandler016: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const propertyId = this.googleAnalyticsPropertyId(
      providerSession?.propertyId,
    );
    const response = await safeConnectorFetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`,
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
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_048_576)
      throw new BadRequestException(
        "Google Analytics property response exceeded Relay bounds",
      );
    let property: Record<string, unknown>;
    try {
      property = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Google Analytics property validation returned invalid JSON",
      );
    }
    if (
      !response.ok ||
      this.stringOrNull(property.name) !== `properties/${propertyId}`
    )
      throw new BadRequestException(
        "Google Analytics connected-property validation failed",
      );
    return {
      googleAnalyticsPropertyId: propertyId,
      googleAnalyticsPropertyName: `properties/${propertyId}`,
      googleAnalyticsPropertyDisplayName:
        this.stringOrNull(property.displayName)?.slice(0, 256) ?? null,
    };
  };

const oauthProviderProfileHandler017: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const customerId = this.googleAdsCustomerId(
      providerSession?.customerId,
      true,
    )!;
    const loginCustomerId = this.googleAdsCustomerId(
      providerSession?.loginCustomerId,
      false,
    );
    const developerToken =
      this.configService.get<string>("GOOGLE_ADS_DEVELOPER_TOKEN")?.trim() ??
      "";
    if (!developerToken || developerToken.length > 256)
      throw new BadRequestException(
        "Google Ads developer token is not configured on Railway",
      );
    const response = await safeConnectorFetch(
      `https://googleads.googleapis.com/v24/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "developer-token": developerToken,
          ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
        },
        body: JSON.stringify({
          query:
            "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_048_576)
      throw new BadRequestException(
        "Google Ads connected-customer response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Google Ads connected-customer validation returned invalid JSON",
      );
    }
    const first = Array.isArray(body.results)
      ? (body.results[0] as Record<string, unknown> | undefined)
      : undefined;
    const customer =
      first?.customer &&
      typeof first.customer === "object" &&
      !Array.isArray(first.customer)
        ? (first.customer as Record<string, unknown>)
        : {};
    if (!response.ok || this.stringOrNull(customer.id) !== customerId)
      throw new BadRequestException(
        "Google Ads connected-customer validation failed",
      );
    return {
      googleAdsCustomerId: customerId,
      googleAdsLoginCustomerId: loginCustomerId,
      googleAdsCustomerName:
        this.stringOrNull(customer.descriptiveName)?.slice(0, 256) ?? null,
    };
  };

const oauthProviderProfileHandler018: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
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
    if (
      !response.ok ||
      !this.stringOrNull(body.sub) ||
      !this.stringOrNull(body.email)
    )
      throw new BadRequestException(
        `${relayGoogleProviderName(appSlug)} connected-account validation failed`,
      );
    return body;
  };

const oauthProviderProfileHandler019: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const accountEmail = this.stringOrNull(
      providerSession?.googleCalendarAccountEmail,
    )?.toLowerCase();
    const defaultCalendarId = this.stringOrNull(
      providerSession?.googleCalendarDefaultCalendarId,
    );
    if (
      !accountEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail) ||
      !defaultCalendarId ||
      defaultCalendarId.length > 320
    )
      throw new BadRequestException(
        "Google Calendar callback is missing its exact account or default Calendar binding",
      );
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    const [primaryResponse, defaultResponse] = await Promise.all([
      safeConnectorFetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
        {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      ),
      safeConnectorFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(defaultCalendarId)}`,
        {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      ),
    ]);
    const primary = (await primaryResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const selected = (await defaultResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (
      !primaryResponse.ok ||
      !defaultResponse.ok ||
      this.stringOrNull(primary.id)?.toLowerCase() !== accountEmail ||
      !this.stringOrNull(selected.id)
    )
      throw new BadRequestException(
        "Google Calendar authorization is not bound to the exact primary account and default Calendar",
      );
    return {
      googleCalendarAccountEmail: accountEmail,
      googleCalendarDefaultCalendarId: defaultCalendarId,
      googleCalendarDefaultCalendarSummary:
        this.stringOrNull(selected.summary)?.slice(0, 500) ?? null,
      googleCalendarDefaultTimeZone:
        this.stringOrNull(selected.timeZone)?.slice(0, 100) ?? null,
    };
  };

const oauthProviderProfileHandler020: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    const [accountResponse, privilegesResponse] = await Promise.all([
      safeConnectorFetch("https://api.cc.email/v3/account/summary", {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch("https://api.cc.email/v3/account/user/privileges", {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    ]);
    const account = (await accountResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const privilegeBody = (await privilegesResponse
      .json()
      .catch(() => [])) as unknown;
    const accountId = this.stringOrNull(account.encoded_account_id);
    const privileges = Array.isArray(privilegeBody)
      ? privilegeBody
          .map((value) =>
            value && typeof value === "object" && !Array.isArray(value)
              ? this.stringOrNull(
                  (value as Record<string, unknown>).privilege_name,
                )
              : null,
          )
          .filter((value): value is string => Boolean(value))
      : [];
    const required = ["account:read", "campaign:read", "ui:campaign:metrics"];
    if (
      !accountResponse.ok ||
      !privilegesResponse.ok ||
      !accountId ||
      !/^[A-Za-z0-9_-]{6,128}$/.test(accountId) ||
      !required.every((privilege) => privileges.includes(privilege))
    )
      throw new BadRequestException(
        "Constant Contact authorization lacks a valid Account or required reporting privileges",
      );
    return {
      constantContactAccountId: accountId,
      constantContactOrganizationName:
        this.stringOrNull(account.organization_name)?.slice(0, 200) ?? null,
      constantContactPrivileges: required,
    };
  };

const oauthProviderProfileHandler021: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.createsend.com/api/v3.3/clients.json",
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
    const body = (await response.json().catch(() => [])) as unknown;
    const clients = Array.isArray(body)
      ? body.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const selected = clients.find((client) => {
      const id = this.stringOrNull(client.ClientID);
      return Boolean(id && /^[A-Fa-f0-9]{32}$/.test(id));
    });
    const clientId = this.stringOrNull(selected?.ClientID)?.toLowerCase();
    if (!response.ok || !clientId)
      throw new BadRequestException(
        "Campaign Monitor authorization did not expose a valid Client",
      );
    return {
      campaignMonitorClientId: clientId,
      campaignMonitorClientName:
        this.stringOrNull(selected?.Name)?.slice(0, 200) ?? null,
      campaignMonitorVisibleClientCount: clients.filter((client) => {
        const id = this.stringOrNull(client.ClientID);
        return Boolean(id && /^[A-Fa-f0-9]{32}$/.test(id));
      }).length,
    };
  };

const oauthProviderProfileHandler022: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.kit.com/v4/account", {
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
    const account =
      body.account &&
      typeof body.account === "object" &&
      !Array.isArray(body.account)
        ? (body.account as Record<string, unknown>)
        : {};
    const timezone =
      account.timezone &&
      typeof account.timezone === "object" &&
      !Array.isArray(account.timezone)
        ? (account.timezone as Record<string, unknown>)
        : {};
    const accountId =
      this.positiveNumericId(account.id) ?? this.stringOrNull(account.id);
    if (!response.ok || !accountId || !/^[A-Za-z0-9_-]{1,64}$/.test(accountId))
      throw new BadRequestException(
        "Kit authorization is not bound to a valid account",
      );
    return {
      convertKitAccountId: accountId,
      convertKitAccountName:
        this.stringOrNull(account.name)?.slice(0, 200) ?? null,
      convertKitPlanType:
        this.stringOrNull(account.plan_type)?.slice(0, 50) ?? null,
      convertKitCreatedAt:
        this.stringOrNull(account.created_at)?.slice(0, 100) ?? null,
      convertKitTimezoneName:
        this.stringOrNull(timezone.name)?.slice(0, 100) ?? null,
    };
  };

const oauthProviderProfileHandler023: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://a.klaviyo.com/api/accounts?fields%5Baccount%5D=name%2Ctimezone%2Ccurrency",
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${accessToken}`,
          revision: "2026-04-15",
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
    const accounts = Array.isArray(body.data) ? body.data : [];
    const resource =
      accounts.length === 1 &&
      accounts[0] &&
      typeof accounts[0] === "object" &&
      !Array.isArray(accounts[0])
        ? (accounts[0] as Record<string, unknown>)
        : null;
    const accountId = this.stringOrNull(resource?.id);
    const attributes =
      resource?.attributes &&
      typeof resource.attributes === "object" &&
      !Array.isArray(resource.attributes)
        ? (resource.attributes as Record<string, unknown>)
        : {};
    if (!response.ok || !accountId || !/^[A-Za-z0-9_-]{1,64}$/.test(accountId))
      throw new BadRequestException(
        "Klaviyo authorization is not bound to exactly one valid Account",
      );
    return {
      klaviyoAccountId: accountId,
      klaviyoAccountName:
        this.stringOrNull(attributes.name)?.slice(0, 200) ?? null,
      klaviyoAccountTimezone:
        this.stringOrNull(attributes.timezone)?.slice(0, 100) ?? null,
      klaviyoAccountCurrency:
        this.stringOrNull(attributes.currency)?.slice(0, 20) ?? null,
    };
  };

const oauthProviderProfileHandler024: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const metadataResponse = await safeConnectorFetch(
      "https://login.mailchimp.com/oauth2/metadata",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `OAuth ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const metadata = (await metadataResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const dataCenter = this.stringOrNull(metadata.dc)?.toLowerCase();
    if (
      !metadataResponse.ok ||
      !dataCenter ||
      !/^[a-z0-9-]{1,20}$/.test(dataCenter)
    )
      throw new BadRequestException(
        "Mailchimp authorization did not return a valid metadata data center",
      );
    const apiOrigin = `https://${dataCenter}.api.mailchimp.com`;
    const metadataApiEndpoint = this.stringOrNull(
      metadata.api_endpoint,
    )?.replace(/\/$/, "");
    if (metadataApiEndpoint && metadataApiEndpoint !== apiOrigin)
      throw new BadRequestException(
        "Mailchimp metadata data center and API endpoint do not match",
      );
    const accountResponse = await safeConnectorFetch(
      `${apiOrigin}/3.0/?fields=account_id%2Caccount_name%2Crole%2Cmember_since`,
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
    const account = (await accountResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const accountId = this.stringOrNull(account.account_id);
    if (!accountResponse.ok || !accountId || !/^[a-f0-9]{32}$/i.test(accountId))
      throw new BadRequestException(
        "Mailchimp authorization is not bound to one valid account",
      );
    return {
      mailchimpDataCenter: dataCenter,
      mailchimpApiOrigin: apiOrigin,
      mailchimpAccountId: accountId,
      mailchimpAccountName:
        this.stringOrNull(account.account_name)?.slice(0, 200) ?? null,
      mailchimpAuthorizingUserRole:
        this.stringOrNull(account.role)?.slice(0, 100) ?? null,
      mailchimpMemberSince:
        this.stringOrNull(account.member_since)?.slice(0, 100) ?? null,
    };
  };

const oauthProviderProfileHandler025: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const baseUrl = this.stringOrNull(providerSession?.filloutBaseUrl)?.replace(
      /\/$/,
      "",
    );
    if (
      !baseUrl ||
      !["https://api.fillout.com", "https://eu-api.fillout.com"].includes(
        baseUrl,
      )
    )
      throw new BadRequestException(
        "Fillout authorization is missing its supported official API base URL",
      );
    const response = await safeConnectorFetch(`${baseUrl}/v1/api/forms`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => [])) as unknown;
    const forms = Array.isArray(body)
      ? body
      : body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).forms
        : [];
    if (!response.ok || !Array.isArray(forms))
      throw new BadRequestException(
        "Fillout authorization could not validate its token-visible Form set",
      );
    return {
      filloutBaseUrl: baseUrl,
      filloutVisibleFormCount: Math.min(forms.length, 25),
    };
  };

const oauthProviderProfileHandler026: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const accessUrl = this.stringOrNull(
      providerSession?.surveyMonkeyAccessUrl,
    )?.replace(/\/$/, "");
    if (
      !accessUrl ||
      ![
        "https://api.surveymonkey.com",
        "https://api.eu.surveymonkey.com",
        "https://api.surveymonkey.ca",
      ].includes(accessUrl)
    )
      throw new BadRequestException(
        "SurveyMonkey authorization is missing its official regional access URL",
      );
    const response = await safeConnectorFetch(`${accessUrl}/v3/users/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const user = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId = this.positiveNumericId(user.id);
    if (!response.ok || !userId)
      throw new BadRequestException(
        "SurveyMonkey authorization is not bound to one valid user",
      );
    return {
      surveyMonkeyAccessUrl: accessUrl,
      surveyMonkeyUserId: userId,
      surveyMonkeyUserName:
        this.stringOrNull(user.username)?.slice(0, 200) ?? null,
    };
  };

export const OAuthProviderProfileHandlers01: OAuthProviderProfileHandlerMap =
  Object.freeze({
    rightsignature: oauthProviderProfileHandler001,
    signeasy: oauthProviderProfileHandler002,
    signrequest: oauthProviderProfileHandler003,
    signnow: oauthProviderProfileHandler004,
    "adobe-acrobat-sign": oauthProviderProfileHandler005,
    mastodon: oauthProviderProfileHandler006,
    threads: oauthProviderProfileHandler007,
    pinterest: oauthProviderProfileHandler008,
    tumblr: oauthProviderProfileHandler009,
    aircall: oauthProviderProfileHandler010,
    "google-classroom": oauthProviderProfileHandler011,
    youtube: oauthProviderProfileHandler012,
    "google-merchant-center": oauthProviderProfileHandler013,
    "google-business-profile": oauthProviderProfileHandler014,
    "google-search-console": oauthProviderProfileHandler015,
    "google-analytics": oauthProviderProfileHandler016,
    "google-ads": oauthProviderProfileHandler017,
    "google-vault": oauthProviderProfileHandler018,
    "google-drive": oauthProviderProfileHandler018,
    "google-docs": oauthProviderProfileHandler018,
    "google-sheets": oauthProviderProfileHandler018,
    "google-slides": oauthProviderProfileHandler018,
    "google-forms": oauthProviderProfileHandler018,
    "google-tasks": oauthProviderProfileHandler018,
    "google-contacts": oauthProviderProfileHandler018,
    "google-photos": oauthProviderProfileHandler018,
    "google-meet": oauthProviderProfileHandler018,
    "google-chat": oauthProviderProfileHandler018,
    "google-calendar": oauthProviderProfileHandler019,
    "constant-contact": oauthProviderProfileHandler020,
    "campaign-monitor": oauthProviderProfileHandler021,
    convertkit: oauthProviderProfileHandler022,
    klaviyo: oauthProviderProfileHandler023,
    "klaviyo-sms": oauthProviderProfileHandler023,
    mailchimp: oauthProviderProfileHandler024,
    "mailchimp-surveys": oauthProviderProfileHandler024,
    fillout: oauthProviderProfileHandler025,
    surveymonkey: oauthProviderProfileHandler026,
  });
