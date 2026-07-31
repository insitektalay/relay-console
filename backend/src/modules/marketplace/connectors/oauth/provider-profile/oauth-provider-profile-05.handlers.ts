import { safeConnectorFetch } from "../../safe-connector-fetch";
import type {
  OAuthProviderProfileHandler,
  OAuthProviderProfileHandlerMap,
} from "./oauth-provider-profile-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderProfileHandler105: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://app.mural.co/api/public/v1/users/me",
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
    const member =
      body.value && typeof body.value === "object" && !Array.isArray(body.value)
        ? (body.value as Record<string, unknown>)
        : body;
    if (!response.ok || !this.stringOrNull(member.id))
      throw new BadRequestException("Mural connected-member validation failed");
    return body;
  };

const oauthProviderProfileHandler106: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.frame.io/v4/me", {
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
    if (!response.ok || !this.stringOrNull(data.id))
      throw new BadRequestException(
        "Frame.io connected-user validation failed",
      );
    return body;
  };

const oauthProviderProfileHandler107: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.wistia.com/modern/account", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Wistia-API-Version": "2026-05",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    )
      throw new BadRequestException(
        "Wistia connected-account validation failed",
      );
    return body;
  };

const oauthProviderProfileHandler108: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://www.meistertask.com/api/persons/me", {
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
    const personId =
      typeof body.id === "number"
        ? String(body.id)
        : this.stringOrNull(body.id);
    if (!response.ok || !personId) {
      throw new BadRequestException(
        "MeisterTask connected-person validation failed",
      );
    }
    return body;
  };

const oauthProviderProfileHandler109: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const url = new URL("https://app.productboard.com/oauth2/token/info");
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
    const space =
      body.space && typeof body.space === "object" && !Array.isArray(body.space)
        ? (body.space as Record<string, unknown>)
        : {};
    const owner =
      body.resource_owner &&
      typeof body.resource_owner === "object" &&
      !Array.isArray(body.resource_owner)
        ? (body.resource_owner as Record<string, unknown>)
        : {};
    if (
      !response.ok ||
      !this.stringOrNull(space.domain) ||
      !this.stringOrNull(space.name) ||
      !this.stringOrNull(owner.email)
    )
      throw new BadRequestException(
        "Productboard workspace and signed-in user validation failed",
      );
    return body;
  };

const oauthProviderProfileHandler110: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const accountSubdomain = this.stringOrNull(
      providerSession?.ahaAccountSubdomain,
    );
    if (!accountSubdomain)
      throw new BadRequestException("Aha! account binding is missing");
    const authority = this.ahaAuthority(accountSubdomain);
    const response = await safeConnectorFetch(`${authority.apiOrigin}/api/v1/me`, {
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
    if (!response.ok || !body || Array.isArray(body))
      throw new BadRequestException(
        "Aha! account and signed-in user validation failed",
      );
    return {
      ...body,
      ahaAccountSubdomain: authority.accountSubdomain,
      ahaApiOrigin: authority.apiOrigin,
    };
  };

const oauthProviderProfileHandler111: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.atlassian.com/oauth/token/accessible-resources",
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
    if (!response.ok)
      throw new BadRequestException(
        `${appSlug === "confluence" ? "Confluence" : appSlug === "jira" ? "Jira" : appSlug === "atlassian-compass" ? "Atlassian Compass" : "Jira Service Management"} site validation failed`,
      );
    const body = (await response.json()) as unknown;
    const sites = Array.isArray(body)
      ? body.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            Boolean(this.stringOrNull((item as Record<string, unknown>).id)) &&
            Boolean(this.stringOrNull((item as Record<string, unknown>).url)),
        )
      : [];
    if (sites.length !== 1)
      throw new BadRequestException(
        `${appSlug === "confluence" ? "Confluence" : appSlug === "jira" ? "Jira" : appSlug === "atlassian-compass" ? "Atlassian Compass" : "Jira Service Management"} OAuth must authorize exactly one Atlassian site; reconnect and select one site`,
      );
    if (appSlug === "confluence") return sites[0];
    const userResponse = await safeConnectorFetch("https://api.atlassian.com/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!userResponse.ok)
      throw new BadRequestException(
        `${appSlug === "jira" ? "Jira" : appSlug === "atlassian-compass" ? "Atlassian Compass" : "Jira Service Management"} user validation failed`,
      );
    const user = (await userResponse.json()) as unknown;
    if (!user || typeof user !== "object" || Array.isArray(user))
      throw new BadRequestException(
        `${appSlug === "jira" ? "Jira" : appSlug === "atlassian-compass" ? "Atlassian Compass" : "Jira Service Management"} user validation returned an invalid profile`,
      );
    return { jiraSite: sites[0], jiraUser: user };
  };

const oauthProviderProfileHandler112: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.outlookGraph.getMe(accessToken);
  };

const oauthProviderProfileHandler113: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.outlookGraph.getMe(accessToken);
  };

const oauthProviderProfileHandler114: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    return this.linkedInApi.getMe(accessToken);
  };

const oauthProviderProfileHandler115: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const mailOrigin = this.requireZohoMailOrigin(
      providerSession?.zohoMailOrigin,
    );
    const response = await safeConnectorFetch(`${mailOrigin}/api/accounts`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new BadRequestException("Zoho Mail account validation failed");
    }
    const accounts = Array.isArray(body.data)
      ? body.data.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const account = accounts[0];
    const accountId =
      this.stringOrNull(account?.accountId) ??
      (typeof account?.accountId === "number" &&
      Number.isSafeInteger(account.accountId)
        ? String(account.accountId)
        : null);
    const email =
      this.stringOrNull(account?.primaryEmailAddress) ??
      this.stringOrNull(account?.emailAddress) ??
      this.stringOrNull(account?.mailboxAddress);
    if (!accountId || !/^[0-9]+$/.test(accountId) || !email) {
      throw new BadRequestException(
        "Zoho Mail did not return a useful authenticated mail account",
      );
    }
    return {
      ...account,
      accountId,
      primaryEmailAddress: email,
      relayZohoAccountsOrigin: this.stringOrNull(
        providerSession?.zohoAccountsOrigin,
      ),
      relayZohoMailOrigin: mailOrigin,
      relayZohoRegion: this.stringOrNull(providerSession?.zohoRegion),
    };
  };

const oauthProviderProfileHandler116: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://nextdoor.com/external/api/partner/v1/me/profiles",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole/1.0 NextdoorConnector",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new BadRequestException("Nextdoor profile validation failed");
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(declared) && declared > 512 * 1024)
      throw new BadRequestException(
        "Nextdoor profile response exceeded Relay bounds",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 512 * 1024)
      throw new BadRequestException(
        "Nextdoor profile response exceeded Relay bounds",
      );
    let body: unknown;
    try {
      body = raw ? (JSON.parse(raw) as unknown) : {};
    } catch {
      throw new BadRequestException(
        "Nextdoor profile response was invalid JSON",
      );
    }
    const object =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const profiles = (
      Array.isArray(body)
        ? body
        : Array.isArray(object.profiles)
          ? object.profiles
          : []
    ).filter(
      (value): value is Record<string, unknown> =>
        Boolean(value) && typeof value === "object" && !Array.isArray(value),
    );
    const allowed = profiles.flatMap((profile) => {
      const explicitType = (
        this.stringOrNull(profile.type) ??
        this.stringOrNull(profile.profile_type) ??
        ""
      ).toLowerCase();
      const entityPage =
        profile.entity_page &&
        typeof profile.entity_page === "object" &&
        !Array.isArray(profile.entity_page)
          ? (profile.entity_page as Record<string, unknown>)
          : {};
      const isEntityProfile = profile.is_entity_profile === true;
      const type = isEntityProfile ? "business" : explicitType;
      const secureProfileId =
        this.stringOrNull(profile.id) ??
        this.stringOrNull(profile.secure_profile_id);
      const entityId = this.stringOrNull(entityPage.id);
      const displayName =
        this.stringOrNull(entityPage.name) ??
        this.stringOrNull(profile.name) ??
        this.stringOrNull(profile.business_name) ??
        this.stringOrNull(profile.neighborhood_name);
      const acceptedNeighbor = type === "neighbor" && profile.verified === true;
      const acceptedBusiness =
        (isEntityProfile && Boolean(entityId) && Boolean(displayName)) ||
        (type === "business" && profile.verified === true);
      if (!secureProfileId || (!acceptedNeighbor && !acceptedBusiness))
        return [];
      return [
        {
          ...profile,
          secure_profile_id: secureProfileId,
          type: acceptedBusiness ? "business" : "neighbor",
          name: displayName,
          business_name: acceptedBusiness ? displayName : null,
          neighborhood_name: this.stringOrNull(profile.neighborhood_name),
          city_name: this.stringOrNull(profile.city_name),
          verified: true,
        },
      ];
    });
    const expected = this.stringOrNull(
      providerSession?.expectedProfileLabel,
    )?.toLowerCase();
    const selected = expected
      ? allowed.find((profile) =>
          [profile.name, profile.business_name, profile.neighborhood_name].some(
            (value) => this.stringOrNull(value)?.toLowerCase() === expected,
          ),
        )
      : allowed.length === 1
        ? allowed[0]
        : null;
    if (!selected) {
      throw new BadRequestException(
        expected
          ? "Nextdoor did not return the expected neighbor or business profile"
          : "Nextdoor returned multiple profiles; provide an exact expected profile label",
      );
    }
    return selected;
  };

const oauthProviderProfileHandler117: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.meetup.com/gql-ext", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "RelayConsole-Meetup/1.0",
      },
      body: JSON.stringify({
        query: "query RelayMeetupSelf { self { id name } }",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 512 * 1024)
      throw new BadRequestException(
        "Meetup connected-member response exceeded Relay bounds",
      );
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new BadRequestException(
        "Eventbrite connected-user response could not be read",
      );
    }
    if (bytes.byteLength > 512 * 1024)
      throw new BadRequestException(
        "Meetup connected-member response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (
        bytes.byteLength ? JSON.parse(new TextDecoder().decode(bytes)) : {}
      ) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Meetup connected-member response was invalid JSON",
      );
    }
    if (!response.ok || Array.isArray(body.errors)) {
      throw new BadRequestException(
        "Meetup connected-member validation failed",
      );
    }
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    const self =
      data.self && typeof data.self === "object" && !Array.isArray(data.self)
        ? (data.self as Record<string, unknown>)
        : {};
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(
        this.stringOrNull(self.id) ??
          (typeof self.id === "number" && Number.isSafeInteger(self.id)
            ? String(self.id)
            : ""),
      )
    ) {
      throw new BadRequestException(
        "Meetup did not return a useful connected member",
      );
    }
    if (!this.stringOrNull(self.name)?.slice(0, 200)) {
      throw new BadRequestException(
        "Meetup did not return a useful connected member",
      );
    }
    return self;
  };

const oauthProviderProfileHandler118: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://www.eventbriteapi.com/v3/users/me/", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-Eventbrite/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 512 * 1024)
      throw new BadRequestException(
        "Eventbrite connected-user response exceeded Relay bounds",
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 512 * 1024)
      throw new BadRequestException(
        "Eventbrite connected-user response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (
        bytes.byteLength ? JSON.parse(new TextDecoder().decode(bytes)) : {}
      ) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Eventbrite connected-user response was invalid JSON",
      );
    }
    if (!response.ok)
      throw new BadRequestException(
        "Eventbrite connected-user validation failed",
      );
    const id =
      this.stringOrNull(body.id) ??
      (typeof body.id === "number" && Number.isSafeInteger(body.id)
        ? String(body.id)
        : null);
    const name = this.stringOrNull(body.name)?.slice(0, 200);
    if (!id || !/^[0-9]{1,64}$/.test(id) || !name) {
      throw new BadRequestException(
        "Eventbrite did not return a useful connected user",
      );
    }
    return { id, name };
  };

const oauthProviderProfileHandler119: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.twist.com/api/v3/users/get_session_user",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok)
      throw new BadRequestException("Twist connected-user validation failed");
    const id =
      this.stringOrNull(body.id) ??
      (typeof body.id === "number" && Number.isSafeInteger(body.id)
        ? String(body.id)
        : null);
    if (!id || !/^[0-9]+$/.test(id) || !this.stringOrNull(body.name)) {
      throw new BadRequestException(
        "Twist did not return a useful connected user",
      );
    }
    return body;
  };

const oauthProviderProfileHandler120: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://webexapis.com/v1/people/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok)
      throw new BadRequestException("Webex connected-Person validation failed");
    if (!this.stringOrNull(body.id) || !this.stringOrNull(body.displayName)) {
      throw new BadRequestException(
        "Webex did not return a useful connected Person",
      );
    }
    return body;
  };

const oauthProviderProfileHandler121: OAuthProviderProfileHandler =
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
        "GoTo connected-organizer validation requires a valid access token",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch("https://api.getgo.com/identity/v1/Users/me", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-GoToMeeting/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new BadRequestException(
        "GoTo connected-organizer validation could not reach the provider",
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 512 * 1024)
      throw new BadRequestException(
        "GoTo connected-organizer response exceeded the allowed size",
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 512 * 1024)
      throw new BadRequestException(
        "GoTo connected-organizer response exceeded the allowed size",
      );
    if (!response.ok)
      throw new BadRequestException(
        "GoTo connected-organizer validation failed",
      );
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
      body =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      throw new BadRequestException(
        "GoTo connected-organizer response was invalid",
      );
    }
    const name =
      body.name && typeof body.name === "object" && !Array.isArray(body.name)
        ? (body.name as Record<string, unknown>)
        : {};
    if (
      !this.stringOrNull(body.id) ||
      !this.stringOrNull(body.userName) ||
      (!this.stringOrNull(name.givenName) &&
        !this.stringOrNull(name.familyName))
    ) {
      throw new BadRequestException(
        "GoTo did not return a useful connected organizer identity",
      );
    }
    return body;
  };

const oauthProviderProfileHandler122: OAuthProviderProfileHandler =
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
        "RingCentral extension validation requires a valid access token",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(
        "https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "RelayConsole-RingCentral/1.0",
          },
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      );
    } catch {
      throw new BadRequestException(
        "RingCentral extension validation could not reach the provider",
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 512 * 1024)
      throw new BadRequestException(
        "RingCentral extension response exceeded the allowed size",
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 512 * 1024)
      throw new BadRequestException(
        "RingCentral extension response exceeded the allowed size",
      );
    if (!response.ok)
      throw new BadRequestException("RingCentral extension validation failed");
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
      body =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      throw new BadRequestException(
        "RingCentral extension response was invalid",
      );
    }
    const account =
      body.account &&
      typeof body.account === "object" &&
      !Array.isArray(body.account)
        ? (body.account as Record<string, unknown>)
        : {};
    if (
      !this.stringOrNull(body.id) ||
      !this.stringOrNull(account.id) ||
      !this.stringOrNull(body.name)
    ) {
      throw new BadRequestException(
        "RingCentral did not return a useful connected extension identity",
      );
    }
    return body;
  };

const oauthProviderProfileHandler123: OAuthProviderProfileHandler =
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
        "Dialpad user validation requires a valid access token",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch("https://dialpad.com/api/v2/users/me", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-Dialpad/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new BadRequestException(
        "Dialpad user validation could not reach the provider",
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 512 * 1024)
      throw new BadRequestException(
        "Dialpad user response exceeded the allowed size",
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 512 * 1024)
      throw new BadRequestException(
        "Dialpad user response exceeded the allowed size",
      );
    if (!response.ok)
      throw new BadRequestException("Dialpad user validation failed");
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
      body =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      throw new BadRequestException("Dialpad user response was invalid");
    }
    const id =
      this.stringOrNull(body.id) ??
      (typeof body.id === "number" && Number.isSafeInteger(body.id)
        ? String(body.id)
        : null);
    const displayName = this.stringOrNull(body.display_name)?.slice(0, 100);
    if (!id || !/^[0-9]+$/.test(id) || !displayName) {
      throw new BadRequestException(
        "Dialpad did not return a useful connected user identity",
      );
    }
    return body;
  };

const oauthProviderProfileHandler124: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.line.me/v2/profile", {
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
    const userId = this.stringOrNull(body.userId);
    const displayName = this.stringOrNull(body.displayName);
    const expectedSubject = this.stringOrNull(providerSession?.lineSubject);
    if (
      !response.ok ||
      !userId ||
      !displayName ||
      !expectedSubject ||
      userId !== expectedSubject
    ) {
      throw new BadRequestException(
        "LINE did not return the OIDC-bound connected profile",
      );
    }
    return body;
  };

const oauthProviderProfileHandler125: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (
      !response.ok ||
      body.ok !== true ||
      !this.stringOrNull(body.team_id) ||
      !this.stringOrNull(body.user_id)
    ) {
      throw new BadRequestException(
        "Slack workspace authorization validation failed",
      );
    }
    return body;
  };

const oauthProviderProfileHandler126: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "RelayConsole",
    };
    const response = await safeConnectorFetch("https://api.github.com/user", {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const id =
      typeof body.id === "number"
        ? String(body.id)
        : this.stringOrNull(body.id);
    if (!response.ok || !id || !this.stringOrNull(body.login)) {
      throw new BadRequestException("GitHub connected-user validation failed");
    }
    const expectedInstallationId = this.stringOrNull(
      providerSession?.githubInstallationId,
    );
    if (!expectedInstallationId) {
      throw new BadRequestException(
        "GitHub App installation binding is missing",
      );
    }
    const installationsResponse = await safeConnectorFetch(
      "https://api.github.com/user/installations?per_page=100",
      {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const installationsBody = (await installationsResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const installations = Array.isArray(installationsBody.installations)
      ? installationsBody.installations.filter(
          (installation): installation is Record<string, unknown> =>
            Boolean(
              installation &&
              typeof installation === "object" &&
              !Array.isArray(installation),
            ),
        )
      : [];
    const installation = installations.find(
      (candidate) => String(candidate.id ?? "") === expectedInstallationId,
    );
    if (!installationsResponse.ok || !installation) {
      throw new BadRequestException(
        "GitHub App installation could not be verified for this user",
      );
    }
    const installationAccount =
      installation.account &&
      typeof installation.account === "object" &&
      !Array.isArray(installation.account)
        ? (installation.account as Record<string, unknown>)
        : {};
    return {
      ...body,
      githubInstallationId: expectedInstallationId,
      githubInstallationAccount:
        this.stringOrNull(installationAccount.login) ??
        this.stringOrNull(installationAccount.name),
      githubInstallationTargetType: this.stringOrNull(installation.target_type),
      githubRepositorySelection: this.stringOrNull(
        installation.repository_selection,
      ),
      githubInstallationPermissions:
        installation.permissions &&
        typeof installation.permissions === "object" &&
        !Array.isArray(installation.permissions)
          ? installation.permissions
          : {},
    };
  };

const oauthProviderProfileHandler127: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://gitlab.com/api/v4/user", {
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
    const id =
      typeof body.id === "number"
        ? String(body.id)
        : this.stringOrNull(body.id);
    if (!response.ok || !id || !this.stringOrNull(body.username)) {
      throw new BadRequestException("GitLab connected-user validation failed");
    }
    return body;
  };

const oauthProviderProfileHandler128: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.bitbucket.org/2.0/user", {
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
    if (
      !response.ok ||
      !this.stringOrNull(body.uuid) ||
      !this.stringOrNull(body.display_name)
    ) {
      throw new BadRequestException(
        "Bitbucket connected-user validation failed",
      );
    }
    return body;
  };

const oauthProviderProfileHandler129: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.notion.com/v1/users/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2026-03-11",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok || !this.stringOrNull(body.id) || body.object !== "user") {
      throw new BadRequestException("Notion connected-bot validation failed");
    }
    return body;
  };

const oauthProviderProfileHandler130: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query:
          "query RelayLinearIdentity { viewer { id name email } organization { id name urlKey } }",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const envelope = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const data =
      envelope.data &&
      typeof envelope.data === "object" &&
      !Array.isArray(envelope.data)
        ? (envelope.data as Record<string, unknown>)
        : {};
    const viewer =
      data.viewer &&
      typeof data.viewer === "object" &&
      !Array.isArray(data.viewer)
        ? (data.viewer as Record<string, unknown>)
        : {};
    const organization =
      data.organization &&
      typeof data.organization === "object" &&
      !Array.isArray(data.organization)
        ? (data.organization as Record<string, unknown>)
        : {};
    if (
      !response.ok ||
      Array.isArray(envelope.errors) ||
      !this.stringOrNull(viewer.id) ||
      !this.stringOrNull(organization.id)
    ) {
      throw new BadRequestException(
        "Linear connected-user and workspace validation failed",
      );
    }
    return { viewer, organization };
  };

const oauthProviderProfileHandler131: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://app.asana.com/api/1.0/users/me?opt_fields=gid,name,email,workspaces.gid,workspaces.name",
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
    const envelope = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const data =
      envelope.data &&
      typeof envelope.data === "object" &&
      !Array.isArray(envelope.data)
        ? (envelope.data as Record<string, unknown>)
        : {};
    if (!response.ok || !this.stringOrNull(data.gid)) {
      throw new BadRequestException("Asana connected-user validation failed");
    }
    return data;
  };

const oauthProviderProfileHandler132: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: accessToken,
        "Content-Type": "application/json",
        "API-Version": "2026-04",
      },
      body: JSON.stringify({
        query:
          "query RelayIdentity { me { id name email account { id name slug } } }",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const envelope = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const data =
      envelope.data &&
      typeof envelope.data === "object" &&
      !Array.isArray(envelope.data)
        ? (envelope.data as Record<string, unknown>)
        : {};
    const me =
      data.me && typeof data.me === "object" && !Array.isArray(data.me)
        ? (data.me as Record<string, unknown>)
        : {};
    const account =
      me.account && typeof me.account === "object" && !Array.isArray(me.account)
        ? (me.account as Record<string, unknown>)
        : {};
    if (
      !response.ok ||
      Array.isArray(envelope.errors) ||
      !this.stringOrNull(me.id) ||
      !this.stringOrNull(account.id)
    )
      throw new BadRequestException(
        "Monday.com connected-user and account validation failed",
      );
    return { me };
  };

const oauthProviderProfileHandler133: OAuthProviderProfileHandler =
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
    const [userResponse, basesResponse] = await Promise.all([
      safeConnectorFetch("https://api.airtable.com/v0/meta/whoami", {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch("https://api.airtable.com/v0/meta/bases?pageSize=25", {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    ]);
    const user = (await userResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const basesEnvelope = (await basesResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    if (
      !userResponse.ok ||
      !basesResponse.ok ||
      !this.stringOrNull(user.id) ||
      !Array.isArray(basesEnvelope.bases)
    ) {
      throw new BadRequestException(
        "Airtable connected-user and resource-grant validation failed",
      );
    }
    return { user, bases: basesEnvelope.bases };
  };

const oauthProviderProfileHandler134: OAuthProviderProfileHandler =
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
    const [userResponse, workspaceResponse] = await Promise.all([
      safeConnectorFetch("https://api.clickup.com/api/v2/user", {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch("https://api.clickup.com/api/v2/team", {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    ]);
    const userEnvelope = (await userResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const workspaceEnvelope = (await workspaceResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const user =
      userEnvelope.user &&
      typeof userEnvelope.user === "object" &&
      !Array.isArray(userEnvelope.user)
        ? (userEnvelope.user as Record<string, unknown>)
        : {};
    if (
      !userResponse.ok ||
      !workspaceResponse.ok ||
      !this.stringOrNull(user.id) ||
      !Array.isArray(workspaceEnvelope.teams)
    ) {
      throw new BadRequestException(
        "ClickUp connected-user and Workspace validation failed",
      );
    }
    return { user, teams: workspaceEnvelope.teams };
  };

export const OAuthProviderProfileHandlers05: OAuthProviderProfileHandlerMap =
  Object.freeze({
    mural: oauthProviderProfileHandler105,
    "frame-io": oauthProviderProfileHandler106,
    wistia: oauthProviderProfileHandler107,
    meistertask: oauthProviderProfileHandler108,
    productboard: oauthProviderProfileHandler109,
    aha: oauthProviderProfileHandler110,
    confluence: oauthProviderProfileHandler111,
    jira: oauthProviderProfileHandler111,
    "jira-service-management": oauthProviderProfileHandler111,
    "atlassian-compass": oauthProviderProfileHandler111,
    outlook: oauthProviderProfileHandler112,
    "microsoft-teams": oauthProviderProfileHandler113,
    linkedin: oauthProviderProfileHandler114,
    "zoho-mail": oauthProviderProfileHandler115,
    nextdoor: oauthProviderProfileHandler116,
    meetup: oauthProviderProfileHandler117,
    eventbrite: oauthProviderProfileHandler118,
    twist: oauthProviderProfileHandler119,
    webex: oauthProviderProfileHandler120,
    "goto-meeting": oauthProviderProfileHandler121,
    ringcentral: oauthProviderProfileHandler122,
    dialpad: oauthProviderProfileHandler123,
    line: oauthProviderProfileHandler124,
    slack: oauthProviderProfileHandler125,
    github: oauthProviderProfileHandler126,
    gitlab: oauthProviderProfileHandler127,
    bitbucket: oauthProviderProfileHandler128,
    notion: oauthProviderProfileHandler129,
    linear: oauthProviderProfileHandler130,
    asana: oauthProviderProfileHandler131,
    "monday-com": oauthProviderProfileHandler132,
    airtable: oauthProviderProfileHandler133,
    clickup: oauthProviderProfileHandler134,
  });
